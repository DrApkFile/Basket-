/**
 * POST /api/basket/carry-forward
 *
 * Offers a one-time carry-forward for an unfilled leg.
 * This is a SEPARATE code path from narrate/copy/construct.
 *
 * Actions:
 * - "check": Find next window for an unfilled leg (returns proposal)
 * - "mark": Mark leg as carriedForward (after approve OR dismiss)
 *
 * CRITICAL: This route does NOT place orders. Order placement happens
 * client-side with user signature, same as normal basket flow.
 */

import { NextRequest, NextResponse } from "next/server";
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import type { BinaryMarket } from "@somnia-chain/markets-sdk";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getBasket } from "@/lib/firestore-server";
import type { LegDoc, LegSide, LiquidityLabel } from "@/lib/firestore-types";
import {
  MIN_TRADEABLE_BUFFER_SECONDS,
  RPC_TIMEOUT_MS,
  withTimeout,
  withRetry,
} from "@/lib/market-constants";

const INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";

interface CarryForwardRequest {
  basketId: string;
  legMarketId: string;
  action: "check" | "mark";
}

interface CarryForwardProposal {
  originalLeg: {
    marketId: string;
    symbol: string;
    side: LegSide;
    quantity: number;
    price: number;
    interval: string;
  };
  nextWindow: {
    marketId: string;
    symbol: string;
    expiry: number;
    currentPrice: number;
    liquidityLabel: LiquidityLabel;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { basketId, legMarketId, action } = (await request.json()) as CarryForwardRequest;

    if (!basketId || !legMarketId || !action) {
      return NextResponse.json(
        { error: "basketId, legMarketId, and action are required" },
        { status: 400 }
      );
    }

    // Get basket
    const basket = await getBasket(basketId);
    if (!basket) {
      return NextResponse.json({ error: "Basket not found" }, { status: 404 });
    }

    // Get legs
    const legsSnap = await getDocs(collection(db, "baskets", basketId, "legs"));
    const legDocRef = legsSnap.docs.find((d) => d.data().marketId === legMarketId);

    if (!legDocRef) {
      return NextResponse.json({ error: "Leg not found" }, { status: 404 });
    }

    const leg = legDocRef.data() as LegDoc;

    // Handle "mark" action: just set carriedForward = true
    if (action === "mark") {
      await updateDoc(legDocRef.ref, { carriedForward: true });
      return NextResponse.json({ success: true, carriedForward: true });
    }

    // === action === "check" ===

    // 1. Verify leg is eligible for carry-forward
    if (leg.carriedForward === true) {
      return NextResponse.json(
        { eligible: false, reason: "Already offered carry-forward" },
        { status: 200 }
      );
    }

    if (leg.filled > 0) {
      return NextResponse.json(
        { eligible: false, reason: "Leg was filled, no carry-forward needed" },
        { status: 200 }
      );
    }

    // 2. Check on-chain status - must be Locked (2) or later
    const exchange = new SomniaMarkets({
      indexerUrl: INDEXER_URL,
      chain: somniaShannon,
      addresses: SOMNIA_TESTNET_ADDRESSES,
    });

    let onchainStatus: number;
    try {
      const onchain = await withRetry(async () => {
        const result = await withTimeout(
          exchange.client.getMarketOnchain(leg.marketId as `0x${string}`),
          RPC_TIMEOUT_MS
        );
        if (!result) throw new Error("RPC timeout");
        return result;
      });
      onchainStatus = onchain.status;
    } catch {
      return NextResponse.json(
        { eligible: false, reason: "Could not verify on-chain status" },
        { status: 200 }
      );
    }

    // Must be past Trading (status >= 2)
    if (onchainStatus < 2) {
      return NextResponse.json(
        { eligible: false, reason: "Window still trading, no carry-forward needed yet" },
        { status: 200 }
      );
    }

    // 3. Find the next Trading-status window in same series
    await exchange.loadMarkets();
    const now = Math.floor(Date.now() / 1000);

    // Extract asset and interval from original leg
    const asset = leg.symbol.split("-")[0]; // BTC or ETH
    const targetInterval = leg.interval;

    // Find candidate markets
    const candidates = Object.values(exchange.markets)
      .filter((m) => {
        if (m.type !== "binary" || !m.active) return false;
        const marketAsset = m.base.split("-")[0];
        if (marketAsset !== asset) return false;

        const info = m.info as BinaryMarket;
        if (info.interval !== targetInterval) return false;

        const expiry = Number(info.expiry);
        // Must expire after buffer
        return expiry > now + MIN_TRADEABLE_BUFFER_SECONDS;
      })
      .map((m) => {
        const info = m.info as BinaryMarket;
        return { market: m, expiry: Number(info.expiry) };
      })
      .sort((a, b) => a.expiry - b.expiry); // Soonest first

    if (candidates.length === 0) {
      return NextResponse.json(
        { eligible: false, reason: `No live ${asset} ${targetInterval} windows available` },
        { status: 200 }
      );
    }

    // Pick the soonest candidate
    const next = candidates[0];
    const nextMarket = next.market;
    const nextInfo = nextMarket.info as BinaryMarket;

    // 4. Verify it's actually Trading on-chain
    let nextStatus: number;
    try {
      const onchain = await withRetry(async () => {
        const result = await withTimeout(
          exchange.client.getMarketOnchain(nextMarket.id as `0x${string}`),
          RPC_TIMEOUT_MS
        );
        if (!result) throw new Error("RPC timeout");
        return result;
      });
      nextStatus = onchain.status;
    } catch {
      return NextResponse.json(
        { eligible: false, reason: "Could not verify next window's on-chain status" },
        { status: 200 }
      );
    }

    if (nextStatus !== 1) {
      return NextResponse.json(
        { eligible: false, reason: "Next window is not Trading" },
        { status: 200 }
      );
    }

    // 5. Fetch current price for the same side
    let currentPrice: number;
    let liquidityLabel: LiquidityLabel = "thin";

    try {
      const book = await withRetry(async () => {
        const result = await withTimeout(
          exchange.fetchOrderBook(`${nextMarket.symbol}#${leg.side}`, 10),
          RPC_TIMEOUT_MS
        );
        if (!result) throw new Error("Order book timeout");
        return result;
      });

      const bestAsk = book.asks[0]?.[0];
      if (typeof bestAsk !== "number" || isNaN(bestAsk) || bestAsk <= 0 || bestAsk >= 1) {
        return NextResponse.json(
          { eligible: false, reason: "No liquidity in next window" },
          { status: 200 }
        );
      }

      // Take the ask + small buffer (same logic as batch-orders)
      currentPrice = Math.min(bestAsk + 0.02, 0.98);

      // Compute depth for liquidity label
      const DEPTH_THRESHOLD = 0.02;
      let depth = 0;
      for (const [price, qty] of book.asks) {
        if (price <= bestAsk * (1 + DEPTH_THRESHOLD)) {
          depth += qty;
        }
      }
      for (const [price, qty] of book.bids) {
        if (price >= (book.bids[0]?.[0] ?? 0) * (1 - DEPTH_THRESHOLD)) {
          depth += qty;
        }
      }

      const tradeCount = Number(nextInfo.tradeCount ?? 0);
      const lastTradeAt = nextInfo.lastTradeAt ? Number(nextInfo.lastTradeAt) : null;
      const timeToExpiry = next.expiry - now;

      if (lastTradeAt === null || tradeCount === 0) {
        liquidityLabel = "stale";
      } else if (now - lastTradeAt > timeToExpiry * 0.5) {
        liquidityLabel = "stale";
      } else if (depth < 50 || tradeCount < 5) {
        liquidityLabel = "thin";
      } else {
        liquidityLabel = "deep";
      }
    } catch {
      return NextResponse.json(
        { eligible: false, reason: "Could not fetch price for next window" },
        { status: 200 }
      );
    }

    // 6. Return the proposal
    const proposal: CarryForwardProposal = {
      originalLeg: {
        marketId: leg.marketId,
        symbol: leg.symbol,
        side: leg.side,
        quantity: leg.quantity,
        price: leg.price,
        interval: leg.interval,
      },
      nextWindow: {
        marketId: nextMarket.id,
        symbol: nextMarket.symbol,
        expiry: next.expiry,
        currentPrice,
        liquidityLabel,
      },
    };

    return NextResponse.json({
      eligible: true,
      proposal,
    });
  } catch (err) {
    console.error("Carry-forward error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
