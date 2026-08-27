/**
 * POST /api/basket/copy
 *
 * Copies a shared basket as an editable draft with LIVE price refresh.
 * Does NOT reuse original stored prices — re-fetches current market data.
 *
 * Flow:
 * 1. Load original basket + legs from Firestore
 * 2. For each leg's marketId, check current on-chain status
 * 3. If still Trading, fetch live price/liquidity data
 * 4. If no longer Trading, drop that leg and report why
 * 5. Return editable draft with live prices for constructor pre-fill
 */

import { NextRequest, NextResponse } from "next/server";
import { getBasket } from "@/lib/firestore-server";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import type { BinaryMarket } from "@somnia-chain/markets-sdk";
import type { LegDoc, ProposedLeg, LiquidityLabel } from "@/lib/firestore-types";

const INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";

interface CopyRequest {
  basketId: string;
  maxSpend?: number; // Optional: user's new max spend (defaults to original)
}

interface DroppedLeg {
  symbol: string;
  reason: string;
}

export async function POST(request: NextRequest) {
  try {
    const { basketId, maxSpend: userMaxSpend } = (await request.json()) as CopyRequest;

    if (!basketId) {
      return NextResponse.json({ error: "basketId required" }, { status: 400 });
    }

    // 1. Load original basket
    const basket = await getBasket(basketId);
    if (!basket) {
      return NextResponse.json({ error: "Basket not found" }, { status: 404 });
    }

    // 2. Load original legs
    const legsSnap = await getDocs(collection(db, "baskets", basketId, "legs"));
    const originalLegs: LegDoc[] = legsSnap.docs.map((d) => d.data() as LegDoc);

    if (originalLegs.length === 0) {
      return NextResponse.json({ error: "No legs found in basket" }, { status: 404 });
    }

    // 3. Create exchange and load markets
    const exchange = new SomniaMarkets({
      indexerUrl: INDEXER_URL,
      chain: somniaShannon,
      addresses: SOMNIA_TESTNET_ADDRESSES,
    });
    await exchange.loadMarkets();

    const now = Math.floor(Date.now() / 1000);
    const FIVE_MINUTES = 5 * 60;

    // 4. Check each leg's current status and fetch live data
    const liveDraftLegs: ProposedLeg[] = [];
    const droppedLegs: DroppedLeg[] = [];

    for (const leg of originalLegs) {
      try {
        // Check on-chain status
        const onchain = await exchange.client.getMarketOnchain(leg.marketId as `0x${string}`);

        // Status 1 = Trading
        if (onchain.status !== 1) {
          const statusNames = ["Listed", "Trading", "Locked", "Settling", "Resolved", "Voided"];
          droppedLegs.push({
            symbol: leg.symbol,
            reason: `Market is ${statusNames[onchain.status] || "unavailable"} (no longer trading)`,
          });
          continue;
        }

        // Find market in registry to get expiry
        const market = Object.values(exchange.markets).find((m) => m.id === leg.marketId);
        if (!market) {
          droppedLegs.push({
            symbol: leg.symbol,
            reason: "Market no longer in registry",
          });
          continue;
        }

        const info = market.info as BinaryMarket;
        const expiry = Number(info.expiry);

        // Check if expiring too soon
        if (expiry <= now + FIVE_MINUTES) {
          droppedLegs.push({
            symbol: leg.symbol,
            reason: "Expires in less than 5 minutes",
          });
          continue;
        }

        // Fetch live order book
        const book = await exchange.fetchOrderBook(`${market.symbol}#YES`, 10);
        const bestAsk = book.asks[0]?.[0] ?? 0.5;
        const bestBid = book.bids[0]?.[0] ?? 0.5;

        // Compute depth score
        const DEPTH_THRESHOLD = 0.02;
        let askDepth = 0;
        let bidDepth = 0;
        for (const [price, qty] of book.asks) {
          if (price <= bestAsk * (1 + DEPTH_THRESHOLD)) {
            askDepth += qty;
          }
        }
        for (const [price, qty] of book.bids) {
          if (price >= bestBid * (1 - DEPTH_THRESHOLD)) {
            bidDepth += qty;
          }
        }
        const depthScore = Math.round(askDepth + bidDepth);

        // Compute liquidity label
        const tradeCount = Number(info.tradeCount ?? 0);
        const lastTradeAtRaw = info.lastTradeAt;
        const lastTradeAt = lastTradeAtRaw ? Number(lastTradeAtRaw) : null;
        const timeToExpiry = expiry - now;

        let liquidityLabel: LiquidityLabel;
        if (lastTradeAt === null || tradeCount === 0) {
          liquidityLabel = "stale";
        } else if (now - lastTradeAt > timeToExpiry * 0.5) {
          liquidityLabel = "stale";
        } else if (depthScore < 50 || tradeCount < 5) {
          liquidityLabel = "thin";
        } else {
          liquidityLabel = "deep";
        }

        // Build liquidity note
        const lastTradeAgo = lastTradeAt ? Math.round((now - lastTradeAt) / 60) : null;
        let liquidityNote: string;
        if (liquidityLabel === "deep") {
          liquidityNote = `Deep liquidity: ${depthScore} depth, ${tradeCount} trades${
            lastTradeAgo !== null ? ` (last ${lastTradeAgo}m ago)` : ""
          }`;
        } else if (liquidityLabel === "thin") {
          liquidityNote = `Thin liquidity: ${depthScore} depth, ${tradeCount} trades — fill price may vary`;
        } else {
          liquidityNote = `Stale market: ${tradeCount} trades${
            lastTradeAgo !== null ? `, last ${lastTradeAgo}m ago` : ", no recent trades"
          } — fill price may differ`;
        }

        // Calculate LIVE price for the side
        const livePrice = leg.side === "YES" ? bestAsk : 1 - bestAsk;

        liveDraftLegs.push({
          marketId: leg.marketId,
          symbol: leg.symbol,
          side: leg.side,
          quantity: leg.quantity, // Keep original quantity as starting point
          price: livePrice, // LIVE price, not stored
          interval: info.interval ?? leg.interval,
          expiry,
          cost: leg.quantity * livePrice,
          liquidityNote,
          liquidityLabel,
        });
      } catch (err) {
        droppedLegs.push({
          symbol: leg.symbol,
          reason: err instanceof Error ? err.message : "Failed to fetch market data",
        });
      }
    }

    if (liveDraftLegs.length === 0) {
      return NextResponse.json(
        {
          error: "No legs from this basket are still trading",
          droppedLegs,
        },
        { status: 400 }
      );
    }

    // 5. Calculate totals with live prices
    const totalCost = liveDraftLegs.reduce((sum, l) => sum + l.cost, 0);
    const totalQuantity = liveDraftLegs.reduce((sum, l) => sum + l.quantity, 0);

    // Determine assets in the draft
    const assets = [...new Set(liveDraftLegs.map((l) => l.symbol.split("-")[0]))];
    const isCrossAsset = assets.length > 1;

    return NextResponse.json({
      // Pre-fill data for constructor
      draft: {
        asset: isCrossAsset ? assets.join("+") : assets[0],
        crossAsset: isCrossAsset,
        legs: liveDraftLegs,
        totalCost,
        worstCase: 0,
        bestCase: totalQuantity,
        // Original reasoning for reference (user can regenerate)
        originalReasoning: basket.aiReasoning,
      },
      // Transparency about what was dropped
      droppedLegs,
      droppedCount: droppedLegs.length,
      originalLegCount: originalLegs.length,
      copiedLegCount: liveDraftLegs.length,
      // Original settings (editable)
      originalMaxSpend: basket.maxSpend,
      suggestedMaxSpend: userMaxSpend ?? Math.ceil(totalCost * 1.1), // 10% buffer
      message:
        droppedLegs.length > 0
          ? `${liveDraftLegs.length} of ${originalLegs.length} windows copied. ${droppedLegs.length} dropped (see droppedLegs for details).`
          : `All ${originalLegs.length} windows copied with live prices.`,
    });
  } catch (err) {
    console.error("Basket copy error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
