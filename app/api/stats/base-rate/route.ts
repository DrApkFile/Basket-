/**
 * GET /api/stats/base-rate
 *
 * Returns historical settlement rates for BTC and ETH markets.
 * Uses parallel requests and limits sample size for speed.
 * Results are cached for 15 minutes.
 */

import { NextResponse } from "next/server";
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

const INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_MARKETS_TO_CHECK = 30; // Limit for speed
const REQUEST_TIMEOUT_MS = 5000; // 5 second timeout per request

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

async function checkMarketWithTimeout(
  exchange: SomniaMarkets,
  marketId: string,
  timeoutMs: number
): Promise<{ status: number; winningOutcome: number } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const onchain = await Promise.race([
      exchange.client.getMarketOnchain(marketId as `0x${string}`),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs)
      ),
    ]);

    clearTimeout(timeout);
    return onchain;
  } catch {
    return null;
  }
}

async function computeBaseRates(): Promise<AssetStats[]> {
  const exchange = new SomniaMarkets({
    indexerUrl: INDEXER_URL,
    chain: somniaShannon,
    addresses: SOMNIA_TESTNET_ADDRESSES,
  });

  await exchange.loadMarkets();

  const results: AssetStats[] = [];

  for (const asset of ["BTC", "ETH"]) {
    // Get binary markets for this asset
    const assetMarkets = Object.values(exchange.markets).filter((m) => {
      if (m.type !== "binary") return false;
      const marketAsset = m.base.split("-")[0];
      return marketAsset === asset;
    });

    // Take a sample of markets to check (limit for speed)
    const marketsToCheck = assetMarkets.slice(0, MAX_MARKETS_TO_CHECK);

    // Check all markets in parallel for speed
    const onchainResults = await Promise.all(
      marketsToCheck.map((m) =>
        checkMarketWithTimeout(exchange, m.id, REQUEST_TIMEOUT_MS)
      )
    );

    let sampleSize = 0;
    let voidedCount = 0;
    let upWins = 0;
    let downWins = 0;

    for (const onchain of onchainResults) {
      if (!onchain) continue;

      // MarketStatus enum: 0=Listed, 1=Trading, 2=Locked, 3=Settling, 4=Resolved, 5=Voided
      if (onchain.status === 4 || onchain.status === 5) {
        sampleSize++;

        if (onchain.status === 5) {
          voidedCount++;
        } else if (onchain.status === 4) {
          // SDK convention: winningOutcome 0 = YES/Up won, 1 = NO/Down won
          if (onchain.winningOutcome === 0) {
            upWins++;
          } else {
            downWins++;
          }
        }
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

    // Compute fresh stats with overall timeout
    const statsPromise = computeBaseRates();
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 15000) // 15 second overall timeout
    );

    const stats = await Promise.race([statsPromise, timeoutPromise]);

    if (!stats) {
      // Timed out - return cached if available, otherwise empty
      if (cache) {
        return NextResponse.json({
          stats: cache.stats,
          cached: true,
          stale: true,
        });
      }
      return NextResponse.json({ stats: [], error: "Timeout computing stats" });
    }

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

    // Return cached data even if stale
    if (cache) {
      return NextResponse.json({
        stats: cache.stats,
        cached: true,
        stale: true,
      });
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to compute base rates" },
      { status: 500 }
    );
  }
}
