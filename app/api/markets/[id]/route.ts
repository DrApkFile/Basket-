/**
 * GET /api/markets/[id]
 * Fetch detailed info for a single market including order book and liquidity.
 * Read-only — no trading actions.
 */

import { NextRequest, NextResponse } from "next/server";
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import type { BinaryMarket } from "@somnia-chain/markets-sdk";

const INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";

type LiquidityLabel = "deep" | "thin" | "stale";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: marketId } = await params;

    if (!marketId) {
      return NextResponse.json({ error: "Market ID required" }, { status: 400 });
    }

    const exchange = new SomniaMarkets({
      indexerUrl: INDEXER_URL,
      chain: somniaShannon,
      addresses: SOMNIA_TESTNET_ADDRESSES,
    });

    await exchange.loadMarkets();
    const now = Math.floor(Date.now() / 1000);

    // Find the market
    const market = Object.values(exchange.markets).find((m) => m.id === marketId);
    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    const info = market.info as BinaryMarket;
    const expiry = Number(info.expiry);

    // Fetch order book for YES side
    let orderBook = { bids: [] as [number, number][], asks: [] as [number, number][] };
    let upPrice = 0.5;
    let downPrice = 0.5;
    let depthScore = 0;

    try {
      const book = await exchange.fetchOrderBook(`${market.symbol}#YES`, 5);
      orderBook = {
        bids: book.bids.slice(0, 5).map(([p, q]) => [p, q] as [number, number]),
        asks: book.asks.slice(0, 5).map(([p, q]) => [p, q] as [number, number]),
      };
      upPrice = book.asks[0]?.[0] ?? 0.5;
      downPrice = 1 - upPrice;

      // Compute depth score (same logic as construct route)
      const DEPTH_THRESHOLD = 0.02;
      let askDepth = 0;
      let bidDepth = 0;
      for (const [price, qty] of book.asks) {
        if (price <= upPrice * (1 + DEPTH_THRESHOLD)) {
          askDepth += qty;
        }
      }
      for (const [price, qty] of book.bids) {
        if (price >= (book.bids[0]?.[0] ?? 0.5) * (1 - DEPTH_THRESHOLD)) {
          bidDepth += qty;
        }
      }
      depthScore = Math.round(askDepth + bidDepth);
    } catch (err) {
      console.warn("Failed to fetch order book:", err);
    }

    // Extract trade data
    const tradeCount = Number(info.tradeCount ?? 0);
    const lastTradeAtRaw = info.lastTradeAt;
    const lastTradeAt = lastTradeAtRaw ? Number(lastTradeAtRaw) : null;

    // Compute liquidity label (same logic as construct route)
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
      liquidityNote = `Thin liquidity: ${depthScore} depth, ${tradeCount} trades — fill prices may vary`;
    } else {
      liquidityNote = `Stale market: ${tradeCount} trades${
        lastTradeAgo !== null ? `, last ${lastTradeAgo}m ago` : ", no recent trades"
      }`;
    }

    return NextResponse.json({
      id: market.id,
      symbol: market.symbol,
      asset: market.base.split("-")[0],
      interval: info.interval ?? "?",
      expiry: new Date(expiry * 1000).toISOString(),
      expiryTimestamp: expiry,
      expiresIn: Math.max(0, expiry - now),
      expiresInMin: Math.max(0, Math.round((expiry - now) / 60)),
      upPrice,
      downPrice,
      orderBook,
      tradeCount,
      lastTradeAt,
      lastTradeAgo,
      depthScore,
      liquidityLabel,
      liquidityNote,
    });
  } catch (err) {
    console.error("Market detail error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
