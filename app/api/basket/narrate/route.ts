/**
 * POST /api/basket/narrate
 *
 * Fast status check for a basket with optional AI narration.
 * Uses parallel RPC calls for speed.
 *
 * SECURITY: On-chain status is source of truth.
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getBasket, updateBasketStatus } from "@/lib/firestore-server";
import { ONCHAIN_STATUS_LABELS, type LegDoc } from "@/lib/firestore-types";
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { collection, getDocs, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  RPC_TIMEOUT_MS,
  withTimeout,
  deriveOutcome,
  type ResolvedOutcome,
} from "@/lib/market-constants";

const INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";

interface LegWithOutcome extends LegDoc {
  resolvedOutcome: ResolvedOutcome;
  payout: number;
}

interface OnchainCheckResult {
  status: number;
  winningOutcome: number;
  outcome: ResolvedOutcome;
  payout: number;
}

async function checkLegOnchain(
  exchange: SomniaMarkets,
  leg: LegDoc
): Promise<OnchainCheckResult | null> {
  try {
    const onchain = await withTimeout(
      exchange.client.getMarketOnchain(leg.marketId as `0x${string}`),
      RPC_TIMEOUT_MS
    );
    if (!onchain) return null;

    // Use shared helper for consistent win/loss logic
    const { outcome, payout } = deriveOutcome(onchain.status, onchain.winningOutcome, leg);

    return { status: onchain.status, winningOutcome: onchain.winningOutcome, outcome, payout };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { basketId, skipNarration } = (await request.json()) as { basketId: string; skipNarration?: boolean };

    if (!basketId) {
      return NextResponse.json({ error: "basketId required" }, { status: 400 });
    }

    // Get basket
    const basket = await getBasket(basketId);
    if (!basket) {
      return NextResponse.json({ error: "Basket not found" }, { status: 404 });
    }

    // Get legs directly from Firestore (faster than getBasketLegsWithStatus)
    const legsSnap = await getDocs(collection(db, "baskets", basketId, "legs"));
    const legs = legsSnap.docs.map((d) => d.data() as LegDoc);

    if (legs.length === 0) {
      return NextResponse.json({ error: "No legs found" }, { status: 404 });
    }

    // Create exchange for on-chain checks
    const exchange = new SomniaMarkets({
      indexerUrl: INDEXER_URL,
      chain: somniaShannon,
      addresses: SOMNIA_TESTNET_ADDRESSES,
    });

    // Check ALL legs in PARALLEL for speed
    const onchainResults = await Promise.all(
      legs.map((leg) => checkLegOnchain(exchange, leg))
    );

    // Combine results
    const legsWithOutcomes: LegWithOutcome[] = legs.map((leg, i) => {
      const result = onchainResults[i];
      if (result) {
        return {
          ...leg,
          onchainStatus: result.status,
          resolvedOutcome: result.outcome,
          payout: result.payout,
        };
      }
      // RPC timed out - use CACHED outcome if available
      // This prevents overwriting a known "settled" status with "pending"
      if (leg.outcome && leg.outcome !== "pending") {
        // We have a cached resolved outcome - compute payout from it
        const payout = leg.outcome === "won" ? leg.filled :
                       leg.outcome === "voided" ? leg.filled * 0.5 : 0;
        return {
          ...leg,
          resolvedOutcome: leg.outcome as ResolvedOutcome,
          payout,
        };
      }
      // No cached outcome - derive from cached status (best effort)
      const cached = deriveOutcome(leg.onchainStatus, 0, leg);
      return {
        ...leg,
        resolvedOutcome: cached.outcome,
        payout: cached.payout,
      };
    });

    // Update Firestore with new statuses AND outcomes (in parallel, fire-and-forget)
    const updates = legsWithOutcomes
      .filter((leg, i) => {
        const result = onchainResults[i];
        if (!result) return false;
        // Update if status changed OR outcome changed
        return result.status !== legs[i].onchainStatus ||
               result.outcome !== legs[i].outcome;
      })
      .map((leg) =>
        updateDoc(legsSnap.docs.find((d) => d.data().marketId === leg.marketId)!.ref, {
          onchainStatus: leg.onchainStatus,
          outcome: leg.resolvedOutcome, // Persist outcome so fallback works correctly
        }).catch(() => {})
      );
    Promise.all(updates); // Don't await - fire and forget

    // Calculate summary stats
    const tradingCount = legsWithOutcomes.filter((l) => l.onchainStatus === 1).length;
    const lockedCount = legsWithOutcomes.filter((l) => l.onchainStatus === 2 || l.onchainStatus === 3).length;
    const resolvedCount = legsWithOutcomes.filter((l) => l.onchainStatus === 4).length;
    const voidedCount = legsWithOutcomes.filter((l) => l.onchainStatus === 5).length;
    const settledCount = resolvedCount + voidedCount;

    const wins = legsWithOutcomes.filter((l) => l.resolvedOutcome === "won").length;
    const losses = legsWithOutcomes.filter((l) => l.resolvedOutcome === "lost").length;
    const voided = legsWithOutcomes.filter((l) => l.resolvedOutcome === "voided").length;
    const pending = legsWithOutcomes.filter((l) => l.resolvedOutcome === "pending").length;

    const totalCost = legsWithOutcomes.reduce((sum, l) => sum + l.cost, 0);
    const totalPayout = legsWithOutcomes.reduce((sum, l) => sum + l.payout, 0);
    const netPnL = totalPayout - totalCost;

    // Find next expiry for pending legs
    const pendingLegs = legsWithOutcomes.filter((l) => l.resolvedOutcome === "pending");
    const nextExpiry = pendingLegs.length > 0
      ? Math.min(...pendingLegs.map((l) => l.expiry))
      : null;
    const minutesToNextExpiry = nextExpiry
      ? Math.max(0, Math.round((nextExpiry - Date.now() / 1000) / 60))
      : null;

    // Determine new basket status
    let newStatus = basket.status;
    if (settledCount === legs.length && basket.status !== "redeemed") {
      newStatus = "settled";
    } else if (basket.status === "pending" && tradingCount > 0) {
      newStatus = "active";
    }

    // Generate narration (skip if requested for speed, or use simple template)
    // BUT always regenerate when status changes, even during fast polling
    let narration = basket.narration || "";
    const statusChanged = newStatus !== basket.status;

    if (statusChanged || (!skipNarration && !narration)) {
      // Try Gemini, but fall back to simple template if it fails
      const apiKey = process.env.GEMINI_API_KEY;

      if (apiKey && settledCount > 0) {
        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

          const prompt = `Narrate this prediction market basket status in 1-2 sentences. Be direct about wins and losses.
Asset: ${basket.asset} | Legs: ${legs.length} | Wins: ${wins} | Losses: ${losses} | Voided: ${voided} | Pending: ${pending}
Cost: $${totalCost.toFixed(2)} | Payout: $${totalPayout.toFixed(2)} | Net: ${netPnL >= 0 ? "+" : ""}$${netPnL.toFixed(2)}
${settledCount === legs.length ? "All legs settled - ready to redeem." : pending > 0 ? `${pending} leg(s) still pending.` : ""}`;

          const result = await Promise.race([
            model.generateContent(prompt),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
          ]);

          if (result) {
            narration = result.response.text().trim();
          }
        } catch {
          // Fall through to simple template
        }
      }

      // Simple template fallback
      if (!narration) {
        if (settledCount === legs.length) {
          narration = `All ${legs.length} positions settled. ${wins} won, ${losses} lost${voided > 0 ? `, ${voided} voided` : ""}. Net: ${netPnL >= 0 ? "+" : ""}$${netPnL.toFixed(2)}. Ready to redeem.`;
        } else if (pending > 0) {
          narration = `${pending} of ${legs.length} positions still pending. ${wins} won so far.${minutesToNextExpiry ? ` Next settles in ~${minutesToNextExpiry}m.` : ""}`;
        } else {
          narration = `${tradingCount} trading, ${lockedCount} locked. Waiting for settlement.`;
        }
      }
    }

    // Update basket status if changed
    if (newStatus !== basket.status || narration !== basket.narration) {
      await updateBasketStatus(basketId, newStatus, narration);
    }

    return NextResponse.json({
      basketId,
      narration,
      status: newStatus,
      summary: {
        total: legs.length,
        trading: tradingCount,
        locked: lockedCount,
        resolved: resolvedCount,
        voided: voidedCount,
        settled: settledCount,
        wins,
        losses,
        pending,
        totalCost,
        totalPayout,
        netPnL,
        minutesToNextExpiry,
      },
      legs: legsWithOutcomes.map((l) => ({
        marketId: l.marketId,
        symbol: l.symbol,
        side: l.side,
        price: l.price,
        filled: l.filled,
        cost: l.cost,
        interval: l.interval,
        expiry: l.expiry,
        onchainStatus: l.onchainStatus,
        outcome: l.resolvedOutcome,
        payout: l.payout,
        redeemable: (l.resolvedOutcome === "won" || l.resolvedOutcome === "voided") && !l.redeemTxHash && l.filled > 0,
        unfilled: !l.filled || l.filled <= 0, // Flag to show order never matched
      })),
    });
  } catch (err) {
    console.error("Basket narrate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
