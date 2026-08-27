/**
 * GET /api/markets
 * List all available live markets with caching to reduce indexer load
 */

import { NextResponse } from "next/server";
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import type { BinaryMarket } from "@somnia-chain/markets-sdk";

const INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";

// Simple in-memory cache to reduce indexer calls (testnet is unstable)
let marketsCache: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

export async function GET() {
  try {
    // Return cached data if fresh
    if (marketsCache && Date.now() - marketsCache.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(marketsCache.data);
    }

    const exchange = new SomniaMarkets({
      indexerUrl: INDEXER_URL,
      chain: somniaShannon,
      addresses: SOMNIA_TESTNET_ADDRESSES,
    });

    await exchange.loadMarkets();
    const now = Math.floor(Date.now() / 1000);

    const markets = Object.values(exchange.markets)
      .filter((m) => m.type === "binary" && m.active)
      .map((m) => {
        const info = m.info as BinaryMarket;
        const expiry = Number(info.expiry);
        return {
          id: m.id,
          symbol: m.symbol,
          base: m.base,
          asset: m.base.split("-")[0], // ETH or BTC
          interval: info.interval ?? "?",
          expiry: new Date(expiry * 1000).toISOString(),
          expiresIn: Math.max(0, expiry - now),
          expiresInMin: Math.max(0, Math.round((expiry - now) / 60)),
        };
      })
      .sort((a, b) => a.expiresIn - b.expiresIn);

    // Extract asset prefix from base like "ETH-244039-25AUG26-2155" -> "ETH"
    const assets = [...new Set(markets.map((m) => m.base.split("-")[0]))];

    const result = {
      count: markets.length,
      availableAssets: assets,
      markets,
    };

    // Cache the result
    marketsCache = { data: result, timestamp: Date.now() };

    return NextResponse.json(result);
  } catch (err) {
    // If we have stale cache and indexer fails, return stale data
    if (marketsCache) {
      console.warn("Indexer failed, returning stale cache:", err);
      return NextResponse.json(marketsCache.data);
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
