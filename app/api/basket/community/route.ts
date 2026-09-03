/**
 * GET /api/basket/community
 *
 * List recent community baskets (public/shared).
 * Returns baskets from all users for the community view.
 *
 * CRITICAL: Only shows baskets where ALL legs are still Trading.
 * The moment any leg moves out of Trading, the basket is no longer
 * actionable and should not appear in the feed.
 */

import { NextResponse } from "next/server";
import { collection, getDocs, query, limit, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BasketDoc, LegDoc } from "@/lib/firestore-types";
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

const INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";
const RPC_TIMEOUT_MS = 2000;

async function checkAllLegsTrading(
  exchange: SomniaMarkets,
  basketId: string
): Promise<{ allTrading: boolean; intervals: string[] }> {
  const legsSnap = await getDocs(collection(db, "baskets", basketId, "legs"));
  const legs = legsSnap.docs.map((d) => d.data() as LegDoc);

  if (legs.length === 0) return { allTrading: false, intervals: [] };

  const intervals = [...new Set(legs.map((l) => l.interval))];

  // Check all legs in parallel with timeout
  const results = await Promise.all(
    legs.map(async (leg) => {
      try {
        const onchain = await Promise.race([
          exchange.client.getMarketOnchain(leg.marketId as `0x${string}`),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), RPC_TIMEOUT_MS)),
        ]);
        // Status 1 = Trading
        return onchain?.status === 1;
      } catch {
        return false; // If we can't verify, assume not trading
      }
    })
  );

  return {
    allTrading: results.every((r) => r === true),
    intervals,
  };
}

export async function GET() {
  try {
    // Simple query - just get shared baskets, filter in memory
    const q = query(
      collection(db, "baskets"),
      where("shared", "==", true),
      limit(100)
    );

    const snap = await getDocs(q);

    // Filter to active/pending and not deleted
    const candidateDocs = snap.docs
      .filter((doc) => {
        const data = doc.data() as BasketDoc & { deleted?: boolean };
        return (
          !data.deleted &&
          (data.status === "pending" || data.status === "active")
        );
      })
      .sort((a, b) => {
        const aTime = (a.data() as BasketDoc).sharedAt?.toMillis?.() ?? 0;
        const bTime = (b.data() as BasketDoc).sharedAt?.toMillis?.() ?? 0;
        return bTime - aTime; // Descending
      })
      .slice(0, 50);

    // Create exchange for on-chain checks
    const exchange = new SomniaMarkets({
      indexerUrl: INDEXER_URL,
      chain: somniaShannon,
      addresses: SOMNIA_TESTNET_ADDRESSES,
    });

    // Check each basket's legs for Trading status (in parallel)
    const basketChecks = await Promise.all(
      candidateDocs.map(async (doc) => {
        const data = doc.data() as BasketDoc;
        const check = await checkAllLegsTrading(exchange, doc.id);

        if (!check.allTrading) {
          return null; // Filter out baskets with any non-Trading leg
        }

        const creatorWallet = data.userId || "";
        const creatorDisplay = creatorWallet
          ? `${creatorWallet.slice(0, 6)}...${creatorWallet.slice(-4)}`
          : "Unknown";

        return {
          id: doc.id,
          asset: data.asset,
          totalSpent: data.totalSpent,
          legCount: data.legCount ?? check.intervals.length ?? 0,
          intervals: check.intervals,
          status: data.status,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
          sharedAt: data.sharedAt?.toDate?.()?.toISOString() ?? null,
          creatorWallet,
          creatorDisplay,
        };
      })
    );

    // Filter out null entries (baskets with expired legs)
    const baskets = basketChecks.filter((b) => b !== null);

    return NextResponse.json({ baskets });
  } catch (err) {
    console.error("Community baskets error:", err);

    // Check if it's an index error - return empty array instead of failing
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes("index") || errorMsg.includes("Index")) {
      console.warn("Firestore index not ready, returning empty baskets");
      return NextResponse.json({ baskets: [] });
    }

    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
