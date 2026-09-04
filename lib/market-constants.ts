/**
 * Shared constants and helpers for market status handling.
 *
 * Centralizes logic that was previously scattered and inconsistent
 * across narrate/route.ts, copy/route.ts, and construct/route.ts.
 */

import type { LegDoc } from "./firestore-types";

/**
 * Minimum seconds before expiry for a market to be considered actionable.
 * Used in both construct (building baskets) and copy (copying baskets).
 *
 * 30 seconds is enough to guard against locking mid-transaction
 * without rejecting 1-5 minute interval markets that are still valid.
 */
export const MIN_TRADEABLE_BUFFER_SECONDS = 30;

/**
 * RPC timeout for on-chain status checks (milliseconds).
 */
export const RPC_TIMEOUT_MS = 3000;

/**
 * MarketStatus enum values from the SDK.
 */
export const MarketStatus = {
  Listed: 0,
  Trading: 1,
  Locked: 2,
  Settling: 3,
  Resolved: 4,
  Voided: 5,
} as const;

export type ResolvedOutcome = "won" | "lost" | "voided" | "pending";

export interface OutcomeResult {
  outcome: ResolvedOutcome;
  payout: number;
}

/**
 * Derive the resolved outcome and payout from market status and leg data.
 *
 * This is the SINGLE source of truth for win/loss/voided/pending logic.
 * Used by both the live RPC check path AND the timeout fallback path
 * in narrate/route.ts to ensure consistent behavior.
 *
 * @param onchainStatus - Market status (0-5)
 * @param winningOutcome - Which outcome won (0=YES, 1=NO), only valid when status=4
 * @param leg - The leg document with side and filled amount
 */
export function deriveOutcome(
  onchainStatus: number,
  winningOutcome: number,
  leg: Pick<LegDoc, "side" | "filled">
): OutcomeResult {
  // Voided market (status 5)
  if (onchainStatus === MarketStatus.Voided) {
    if (leg.filled > 0) {
      return { outcome: "voided", payout: leg.filled * 0.5 };
    }
    return { outcome: "lost", payout: 0 }; // No position = nothing to claim
  }

  // Resolved market (status 4)
  if (onchainStatus === MarketStatus.Resolved) {
    // SDK convention: winningOutcome 0 = YES won, 1 = NO won
    const legIsYes = leg.side === "YES";
    const marketWentTheirWay =
      (winningOutcome === 0 && legIsYes) || (winningOutcome === 1 && !legIsYes);

    if (leg.filled > 0 && marketWentTheirWay) {
      return { outcome: "won", payout: leg.filled };
    }
    // Either wrong side or no filled position
    return { outcome: "lost", payout: 0 };
  }

  // Still pending (Trading, Locked, Settling, or Listed)
  return { outcome: "pending", payout: 0 };
}

/**
 * Race a promise against a timeout.
 * Returns null if the timeout wins.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T | null> {
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), ms)
  );
  return Promise.race([promise, timeout]);
}

/**
 * Retry a function once on failure, with optional delay between attempts.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retryDelayMs = 500
): Promise<T> {
  try {
    return await fn();
  } catch (firstError) {
    await new Promise((r) => setTimeout(r, retryDelayMs));
    return await fn(); // Let second attempt throw if it fails
  }
}
