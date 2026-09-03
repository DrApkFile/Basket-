/**
 * Server-side Firestore operations for basket tracking.
 *
 * CRITICAL: These functions are ONLY called from API routes (server-side).
 * They enforce the rule: verify on-chain status via getMarketOnchain() BEFORE
 * any Firestore write. The client never writes basket/leg status directly.
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  getDoc,
  serverTimestamp,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { BasketDoc, LegDoc, BasketProposal, LegOutcome } from "./firestore-types";
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

const INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";

// Create a read-only exchange instance for server-side on-chain verification
function getServerExchange(): SomniaMarkets {
  return new SomniaMarkets({
    indexerUrl: INDEXER_URL,
    chain: somniaShannon,
    addresses: SOMNIA_TESTNET_ADDRESSES,
  });
}

/**
 * Create a new basket document after user approves the AI proposal.
 * This is called AFTER orders are placed on-chain.
 */
export async function createBasket(
  userId: string,
  proposal: BasketProposal,
  legResults: Array<{
    marketId: string;
    orderId: string;
    txHash: string;
    filled: number;
  }>
): Promise<string> {
  const basketRef = doc(collection(db, "baskets"));
  const basketId = basketRef.id;

  const basketDoc: BasketDoc = {
    userId,
    asset: proposal.asset,
    createdAt: serverTimestamp() as Timestamp,
    status: "active",
    totalSpent: proposal.totalCost,
    maxSpend: proposal.totalCost, // actual spent
    aiReasoning: proposal.reasoning,
    legCount: proposal.legs.length, // Store for fast queries
  };

  await setDoc(basketRef, basketDoc);

  // Create leg documents
  const exchange = getServerExchange();
  for (const leg of proposal.legs) {
    const result = legResults.find((r) => r.marketId === leg.marketId);
    if (!result) continue;

    // CRITICAL: Verify on-chain status before writing leg
    const onchain = await exchange.client.getMarketOnchain(leg.marketId as `0x${string}`);

    const legDoc: LegDoc = {
      marketId: leg.marketId,
      symbol: leg.symbol,
      side: leg.side,
      quantity: leg.quantity,
      price: leg.price,
      cost: leg.cost,
      interval: leg.interval,
      expiry: leg.expiry,
      orderId: result.orderId,
      txHash: result.txHash,
      filled: result.filled,
      onchainStatus: onchain.status,
      outcome: null, // pending until market resolves
      redeemTxHash: null,
    };

    await setDoc(doc(db, "baskets", basketId, "legs", leg.marketId), legDoc);
  }

  return basketId;
}

/**
 * Update leg status by verifying on-chain state first.
 * Called by the narrate/monitor flow.
 */
export async function updateLegStatus(
  basketId: string,
  marketId: string
): Promise<{ status: number; outcome: LegOutcome | null }> {
  const exchange = getServerExchange();

  // CRITICAL: Always read on-chain status before updating Firestore
  const onchain = await exchange.client.getMarketOnchain(marketId as `0x${string}`);

  let outcome: LegOutcome | null = null;

  // Determine outcome based on on-chain status
  // MarketStatus enum: 0=Listed, 1=Trading, 2=Locked, 3=Settling, 4=Resolved, 5=Voided
  if (onchain.status === 4) {
    // Resolved — check if winning side
    // For now, we'll set to "pending" until we check the actual outcome
    // The full check requires comparing position side to winning outcome
    outcome = "pending";
  } else if (onchain.status === 5) {
    // Voided — both sides redeem at 0.5
    outcome = "voided";
  }

  const legRef = doc(db, "baskets", basketId, "legs", marketId);
  await updateDoc(legRef, {
    onchainStatus: onchain.status,
    ...(outcome && { outcome }),
  });

  return { status: onchain.status, outcome };
}

/**
 * Get all legs for a basket with their current on-chain status.
 * Refreshes status from chain before returning.
 * Uses PARALLEL calls with timeout for speed.
 */
export async function getBasketLegsWithStatus(basketId: string): Promise<LegDoc[]> {
  const exchange = getServerExchange();
  const legsSnap = await getDocs(collection(db, "baskets", basketId, "legs"));

  const RPC_TIMEOUT_MS = 3000;

  // Check ALL legs in PARALLEL for speed
  const results = await Promise.all(
    legsSnap.docs.map(async (legSnap) => {
      const leg = legSnap.data() as LegDoc;

      try {
        // Race against timeout
        const onchain = await Promise.race([
          exchange.client.getMarketOnchain(leg.marketId as `0x${string}`),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), RPC_TIMEOUT_MS)),
        ]);

        if (onchain && onchain.status !== leg.onchainStatus) {
          // Update Firestore with fresh status (fire-and-forget for speed)
          updateDoc(legSnap.ref, { onchainStatus: onchain.status }).catch(() => {});
          return { ...leg, onchainStatus: onchain.status };
        }
      } catch {
        // Market might be finalized — that's ok, return cached status
      }

      return leg;
    })
  );

  return results;
}

/**
 * Get baskets for a user, ordered by most recently created first.
 * Note: Sorting done client-side to avoid needing a composite Firestore index.
 */
export async function getUserBaskets(userId: string): Promise<Array<BasketDoc & { id: string }>> {
  const q = query(
    collection(db, "baskets"),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .filter((d) => !(d.data() as BasketDoc & { deleted?: boolean }).deleted) // Exclude soft-deleted
    .map((d) => ({ id: d.id, ...(d.data() as BasketDoc) }))
    .sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? 0;
      const bTime = b.createdAt?.toMillis?.() ?? 0;
      return bTime - aTime; // Descending (newest first)
    });
}

/**
 * Get a single basket by ID.
 */
export async function getBasket(basketId: string): Promise<(BasketDoc & { id: string }) | null> {
  const snap = await getDoc(doc(db, "baskets", basketId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as BasketDoc) };
}

/**
 * Update basket status and optional narration.
 */
export async function updateBasketStatus(
  basketId: string,
  status: BasketDoc["status"],
  narration?: string
): Promise<void> {
  const updates: Partial<BasketDoc> = {
    status,
    updatedAt: serverTimestamp() as Timestamp,
  };
  if (narration) {
    updates.narration = narration;
  }
  await updateDoc(doc(db, "baskets", basketId), updates);
}

/**
 * Mark a leg as redeemed.
 */
export async function markLegRedeemed(
  basketId: string,
  marketId: string,
  redeemTxHash: string,
  outcome: LegOutcome
): Promise<void> {
  await updateDoc(doc(db, "baskets", basketId, "legs", marketId), {
    redeemTxHash,
    outcome,
  });
}
