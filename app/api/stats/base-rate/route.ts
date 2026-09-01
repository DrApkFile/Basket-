/**
 * GET /api/stats/base-rate
 *
 * Returns historical settlement rates for BTC and ETH markets.
 * Queries finalized markets from the venue and computes Up vs Down win rates.
 * Results are cached for 15 minutes to avoid hammering the indexer.
 */

import { NextResponse } from "next/server";
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

const INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface AssetStats {
  asset: string;
  sampleSize: number;
  voidedCount: number;
  upWinPct: number;
  downWinPct: number;
  lastUpdated: string;
}

interface CachedStats {
  stats: AssetStats[];
  timestamp: number;
}

let cache: CachedStats | null = null;

async function computeBaseRates(): Promise<AssetStats[]> {
  const exchange = new SomniaMarkets({
    indexerUrl: INDEXER_URL,
    chain: somniaShannon,
    addresses: SOMNIA_TESTNET_ADDRESSES,
  });

  await exchange.loadMarkets();

  const results: AssetStats[] = [];

  for (const asset of ["BTC", "ETH"]) {
    let sampleSize = 0;
    let voidedCount = 0;
    let upWins = 0;
    let downWins = 0;

    // Get all markets and filter to finalized ones for this asset
    const allMarkets = Object.values(exchange.markets).filter((m) => {
      if (m.type !== "binary") return false;
      const marketAsset = m.base.split("-")[0];
      return marketAsset === asset;
    });

    // Check on-chain status for each market (limit to avoid too many RPC calls)
    const marketsToCheck = allMarkets.slice(0, 200);

    for (const market of marketsToCheck) {
      try {
        const onchain = await exchange.client.getMarketOnchain(market.id as `0x${string}`);

        // MarketStatus enum: 0=Listed, 1=Trading, 2=Locked, 3=Settling, 4=Resolved, 5=Voided
        if (onchain.status === 4 || onchain.status === 5) {
          sampleSize++;

          if (onchain.status === 5) {
            voidedCount++;
          } else if (onchain.status === 4) {
            // Resolved - check winning outcome
            // winningOutcome: 0 = Down/NO won, 1 = Up/YES won
            if (onchain.winningOutcome === 1) {
              upWins++;
            } else {
              downWins++;
            }
          }
        }
      } catch {
        // Skip markets we can't query
      }
    }

    const resolvedCount = sampleSize - voidedCount;
    const upWinPct = resolvedCount > 0 ? Math.round((upWins / resolvedCount) * 100) : 0;
    const downWinPct = resolvedCount > 0 ? 100 - upWinPct : 0;

    results.push({
      asset,
      sampleSize,
      voidedCount,
      upWinPct,
      downWinPct,
      lastUpdated: new Date().toISOString(),
    });
  }

  return results;
}

export async function GET() {
  try {
    const now = Date.now();

    // Return cached data if still valid
    if (cache && now - cache.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        stats: cache.stats,
        cached: true,
        cacheAge: Math.round((now - cache.timestamp) / 1000),
      });
    }

    // Compute fresh stats
    const stats = await computeBaseRates();

    // Update cache
    cache = {
      stats,
      timestamp: now,
    };

    return NextResponse.json({
      stats,
      cached: false,
    });
  } catch (err) {
    console.error("Base rate stats error:", err);

    // Return cached data even if stale, if available
    if (cache) {
      return NextResponse.json({
        stats: cache.stats,
        cached: true,
        stale: true,
        error: "Using stale cache due to fetch error",
      });
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to compute base rates" },
      { status: 500 }
    );
  }
}
