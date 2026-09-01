/**
 * Firestore Schema for Basket Tracking
 *
 * CRITICAL SECURITY RULES (from SPEC.md):
 * 1. Firestore is a UI cache synced FROM on-chain reads — never the reverse
 * 2. All writes happen only after server has verified on-chain status via getMarketOnchain()
 * 3. The client NEVER writes basket/leg status directly — only server-side code does
 *
 * Structure:
 *   baskets/{basketId}
 *     - userId: string (Firebase Auth UID)
 *     - asset: string (e.g., "BTC", "ETH")
 *     - createdAt: Timestamp
 *     - status: "pending" | "active" | "settled" | "redeemed"
 *     - totalSpent: number (collateral spent across all legs)
 *     - maxSpend: number (user's stated max spend limit)
 *     - aiReasoning: string (Gemini's explanation for the basket construction)
 *     - legs/{marketId}
 *       - marketId: string (on-chain market ID, hex)
 *       - symbol: string (e.g., "BTC-0-25AUG26-0500/tUSDC")
 *       - side: "YES" | "NO"
 *       - quantity: number
 *       - price: number
 *       - interval: string (e.g., "5m", "1h")
 *       - expiry: number (unix timestamp)
 *       - orderId: string | null (set after order placed)
 *       - txHash: string | null
 *       - filled: number
 *       - onchainStatus: number (0-5, from getMarketOnchain)
 *       - outcome: "pending" | "won" | "lost" | "voided" | null
 *       - redeemTxHash: string | null
 */

import type { Timestamp } from "firebase/firestore";

export type BasketStatus = "pending" | "active" | "settled" | "redeemed";
export type LegOutcome = "pending" | "won" | "lost" | "voided";
export type LegSide = "YES" | "NO";

export interface BasketDoc {
  userId: string;
  asset: string;
  createdAt: Timestamp;
  status: BasketStatus;
  totalSpent: number;
  maxSpend: number;
  aiReasoning: string;
  legCount?: number; // Number of legs, stored for fast queries
  narration?: string; // Plain-language status update from AI
  updatedAt?: Timestamp;
  shared?: boolean; // If true, visible in community tab
  sharedAt?: Timestamp;
}

export interface LegDoc {
  marketId: string; // hex, e.g., "0x..."
  symbol: string;
  side: LegSide;
  quantity: number;
  price: number;
  cost: number; // quantity * price
  interval: string;
  expiry: number; // unix seconds
  orderId: string | null;
  txHash: string | null;
  filled: number;
  onchainStatus: number; // 0=Listed, 1=Trading, 2=Locked, 3=Settling, 4=Resolved, 5=Voided
  outcome: LegOutcome | null;
  redeemTxHash: string | null;
}

// Input for constructing a basket (from user form)
export interface BasketConstructInput {
  asset: string; // "BTC", "ETH", or "BTC+ETH" for cross-asset
  numWindows: number; // 2-5 windows
  maxSpend: number; // max collateral to spend
  riskTolerance: "low" | "medium" | "high";
  crossAsset?: boolean; // true = allow BTC + ETH together
}

// Risk comparison (computed, not AI-generated)
export interface RiskComparisonData {
  basketStdDev: number;
  singleBetStdDev: number;
  varianceReductionPct: number;
}

// Availability note when fewer windows than requested
export interface AvailabilityNote {
  requested: number;
  available: number;
  message: string;
}

// Proposal from AI constructor (before user approval)
export interface BasketProposal {
  asset: string;
  legs: ProposedLeg[];
  totalCost: number;
  worstCase: number; // worst-case payout (all lose)
  bestCase: number; // best-case payout (all win)
  reasoning: string; // AI's explanation
  // Computed risk comparison (deterministic, not from AI)
  riskComparison: RiskComparisonData;
  // Tamper-evident hash
  proposalHash: string;
  proposalTimestamp: string; // ISO timestamp
  // Availability transparency
  availabilityNote?: AvailabilityNote;
}

export type LiquidityLabel = "deep" | "thin" | "stale";

export interface ProposedLeg {
  marketId: string;
  symbol: string;
  side: LegSide;
  quantity: number;
  price: number;
  interval: string;
  expiry: number;
  cost: number; // quantity * price
  liquidityNote: string; // Data-backed liquidity summary for UI
  liquidityLabel: LiquidityLabel; // For styling
}

// Status labels for display
export const ONCHAIN_STATUS_LABELS = [
  "Listed",
  "Trading",
  "Locked",
  "Settling",
  "Resolved",
  "Voided",
] as const;
