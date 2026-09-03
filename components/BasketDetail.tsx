"use client";

import { useState, useEffect, useCallback } from "react";
import { useWalletClient, useAccount, usePublicClient } from "wagmi";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createExchange } from "@/lib/somnia";
import type { BasketDoc, LegDoc } from "@/lib/firestore-types";
import PositionCard from "./PositionCard";
import { AssetIcon, LoomIcon } from "./icons";

interface BasketDetailProps {
  basketId: string;
  onClose?: () => void;
}

interface NarrationResponse {
  narration: string;
  status: string;
  summary: {
    total: number;
    wins: number;
    losses: number;
    pending: number;
    totalCost: number;
    totalPayout: number;
    netPnL: number;
    minutesToNextExpiry: number | null;
  };
  legs: Array<{
    marketId: string;
    symbol: string;
    side: string;
    price: number;
    filled: number;
    cost: number;
    interval: string;
    expiry: number;
    onchainStatus: number;
    outcome: string;
    payout: number;
    redeemable: boolean;
  }>;
}

interface RedeemableLeg {
  marketId: string;
  symbol: string;
  side: string;
  filled: number;
  outcomeIndex: number;
  estimatedPayout: number;
}

export default function BasketDetail({ basketId, onClose }: BasketDetailProps) {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const [basket, setBasket] = useState<(BasketDoc & { id: string }) | null>(null);
  const [narration, setNarration] = useState<NarrationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemProgress, setRedeemProgress] = useState("");
  const [sharing, setSharing] = useState(false);

  // Real-time subscription to basket document
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, "baskets", basketId),
      (snap) => {
        if (snap.exists()) {
          setBasket({ id: snap.id, ...(snap.data() as BasketDoc) });
        }
        setLoading(false);
      },
      (error) => {
        console.error("Basket subscription error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [basketId]);

  // Fetch narration (poll for updates)
  const fetchNarration = useCallback(async (skipNarration = false) => {
    try {
      const res = await fetch("/api/basket/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basketId, skipNarration }),
      });
      if (res.ok) {
        const data = await res.json();
        setNarration(data);
      }
    } catch (err) {
      console.error("Narration fetch error:", err);
    }
  }, [basketId]);

  // Initial fetch and polling for status updates
  useEffect(() => {
    // Initial fetch with full narration
    fetchNarration(false);

    // Poll every 5 seconds for faster state updates (skip narration for speed)
    const interval = setInterval(() => {
      fetchNarration(true); // Skip AI narration for faster polling
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchNarration]);

  // Handle batch redemption
  async function handleRedeem() {
    if (!walletClient || !basket) {
      console.error("handleRedeem: missing walletClient or basket");
      return;
    }

    if (!address) {
      console.error("handleRedeem: no wallet address");
      return;
    }

    setRedeeming(true);
    setRedeemProgress("Checking redeemable legs...");

    try {
      // Get redeemable legs from server - use connected address, not basket.userId
      const res = await fetch("/api/basket/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basketId,
          walletAddress: address,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to get redeemable legs");
      }

      // Handle case where API returns message instead of redeemableLegs
      if (data.message === "No legs to redeem" || data.redeemed === 0) {
        setRedeemProgress("No legs to redeem - may already be redeemed");
        setTimeout(() => setRedeeming(false), 3000);
        return;
      }

      const { redeemableLegs, totalEstimatedPayout } = data as {
        redeemableLegs: RedeemableLeg[];
        totalEstimatedPayout: number;
      };

      if (!redeemableLegs || redeemableLegs.length === 0) {
        setRedeemProgress("No redeemable legs found");
        setTimeout(() => setRedeeming(false), 3000);
        return;
      }

      console.log("Redeemable legs:", redeemableLegs);
      setRedeemProgress(`Redeeming ${redeemableLegs.length} legs (~$${totalEstimatedPayout.toFixed(2)})...`);

      // Create exchange with wallet for redemption
      const exchange = createExchange();
      exchange.setSigner({ walletClient });

      // NOTE: We use trader.redeemMany() directly instead of exchange.redeem()
      // because settled markets are removed from loadMarkets() registry (documented gotcha)

      const redemptions: Array<{ marketId: string; txHash: string; outcome: "won" | "voided" }> = [];
      const errors: string[] = [];

      // Build entries for batch redemption
      // SDK convention: outcomeIdx 0 = YES, 1 = NO (same as winningOutcome)
      // Amount must be in raw units (6 decimals for tUSDC)
      const entries = redeemableLegs.map((leg) => {
        // leg.side is "YES" or "NO" from our API
        const outcomeIdx = leg.side === "YES" ? 0 : 1;
        // filled is number of contracts, convert to raw units (1 contract = 1 USDC = 1e6 raw)
        const rawAmount = BigInt(Math.round(leg.filled * 1_000_000));

        console.log(`Entry: marketId=${leg.marketId}, side=${leg.side}, outcomeIdx=${outcomeIdx}, filled=${leg.filled}, rawAmount=${rawAmount}`);

        return {
          marketId: leg.marketId as `0x${string}`,
          outcomeIdx: outcomeIdx as 0 | 1,
          amount: rawAmount,
        };
      });

      // Filter out any entries with 0 amount
      const validEntries = entries.filter(e => e.amount > BigInt(0));
      if (validEntries.length === 0) {
        setRedeemProgress("No valid amounts to redeem (all zero)");
        setTimeout(() => setRedeeming(false), 3000);
        return;
      }

      console.log("Redeem entries:", validEntries);
      setRedeemProgress(`Signing redemption transaction...`);

      try {
        // Batch redeem all legs in one transaction
        const result = await exchange.trader.redeemMany({ entries: validEntries });
        console.log("Redeem result:", result);

        const txHash = result.hash ?? "";

        if (!txHash) {
          throw new Error("No transaction hash returned");
        }

        // Wait for transaction confirmation
        setRedeemProgress("Waiting for confirmation...");

        // Wait for receipt using the public client
        const receipt = await publicClient?.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
        console.log("Transaction receipt:", receipt);

        if (receipt?.status !== "success") {
          throw new Error("Transaction reverted on-chain");
        }

        // Mark all as redeemed only after confirmation
        for (const leg of redeemableLegs) {
          redemptions.push({
            marketId: leg.marketId,
            txHash,
            outcome: leg.estimatedPayout === leg.filled ? "won" : "voided",
          });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("Batch redeem failed:", err);

        // Handle common errors gracefully without showing raw SDK messages
        if (errMsg.includes("ZeroAmount")) {
          // Already redeemed or no balance - not an error for user
          setRedeemProgress("Positions may have already been redeemed");
          setTimeout(() => setRedeeming(false), 3000);
          return;
        } else if (errMsg.includes("user rejected") || errMsg.includes("User rejected")) {
          setRedeemProgress("Transaction cancelled");
          setTimeout(() => setRedeeming(false), 2000);
          return;
        } else if (errMsg.includes("insufficient") || errMsg.includes("Insufficient")) {
          setRedeemProgress("Insufficient balance for gas fees");
          setTimeout(() => setRedeeming(false), 3000);
          return;
        } else {
          // Show actual error for debugging
          errors.push(errMsg);
        }
      }

      // Record redemptions in Firestore
      if (redemptions.length > 0) {
        setRedeemProgress("Recording redemptions...");
        await fetch("/api/basket/redeem", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ basketId, redemptions }),
        });
        setRedeemProgress(`Redeemed ${redemptions.length} legs!`);
      } else if (errors.length > 0) {
        setRedeemProgress(`Failed: ${errors[0]}`);
      } else {
        setRedeemProgress("No redemptions completed");
      }

      await fetchNarration(); // Refresh status
    } catch (err) {
      console.error("Redeem error:", err);
      const errMsg = err instanceof Error ? err.message : String(err);

      // Show user-friendly messages instead of raw errors
      if (errMsg.includes("user rejected") || errMsg.includes("User rejected")) {
        setRedeemProgress("Transaction cancelled");
      } else if (errMsg.includes("ZeroAmount")) {
        setRedeemProgress("Positions may have already been redeemed");
      } else {
        setRedeemProgress(`Error: ${errMsg}`);
      }
    } finally {
      setTimeout(() => setRedeeming(false), 4000);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-orange-500" />
        <p className="mt-4 text-sm text-white/50">Loading basket...</p>
      </div>
    );
  }

  if (!basket) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <p className="text-red-400">Basket not found</p>
      </div>
    );
  }

  const canRedeem = narration?.legs?.some((l) => l.redeemable) ?? false;
  const allSettled = narration?.summary?.pending === 0;
  const isOwner = address && basket?.userId === address;
  const canShare = isOwner && basket?.status !== "settled" && basket?.status !== "redeemed";

  async function handleToggleShare() {
    if (!basket || !isOwner) return;
    setSharing(true);
    try {
      const res = await fetch("/api/basket/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basketId,
          userId: address,
          share: !basket.shared,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update sharing");
      }
    } catch (err) {
      console.error("Share toggle error:", err);
      alert(err instanceof Error ? err.message : "Failed to update sharing");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/6 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-green-500/10">
            <AssetIcon asset={basket.asset} size={24} />
          </div>
          <div>
            <h3 className="font-semibold">{basket.asset} Basket</h3>
            <p className="font-mono text-xs text-white/40">{basketId.slice(0, 12)}...</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Share to Community toggle */}
          {canShare && (
            <button
              onClick={handleToggleShare}
              disabled={sharing}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                basket?.shared
                  ? "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                  : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              {sharing ? "..." : basket?.shared ? "Shared ✓" : "Share"}
            </button>
          )}
          {/* Copy link */}
          <button
            onClick={() => {
              const url = `${window.location.origin}/basket/${basketId}`;
              navigator.clipboard.writeText(url);
            }}
            className="rounded-lg bg-white/5 p-2 text-white/50 transition-all hover:bg-white/10 hover:text-white"
            title="Copy link"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>
          <span
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase ${
              basket.status === "redeemed"
                ? "bg-green-500/15 text-green-400"
                : basket.status === "settled"
                ? "bg-blue-500/15 text-blue-400"
                : "bg-yellow-500/15 text-yellow-400"
            }`}
          >
            {basket.status}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg bg-white/5 p-2 text-white/40 transition-all hover:bg-white/10 hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* AI Narration */}
      {basket.narration && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-orange-400">
            <LoomIcon size={14} style={{ color: "#F97316" }} />
            AI Monitor
          </div>
          <p className="text-sm leading-relaxed text-white/70">{basket.narration}</p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-4 grid grid-cols-4 gap-3">
        {narration?.summary ? (
          <>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
              <div className="text-[10px] text-white/40">Wins</div>
              <div className="mt-1 font-mono text-lg font-semibold text-green-400">{narration.summary.wins}</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
              <div className="text-[10px] text-white/40">Losses</div>
              <div className="mt-1 font-mono text-lg font-semibold text-red-400">{narration.summary.losses}</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
              <div className="text-[10px] text-white/40">Pending</div>
              <div className="mt-1 font-mono text-lg font-semibold text-yellow-400">{narration.summary.pending}</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
              <div className="text-[10px] text-white/40">Net P&L</div>
              <div
                className={`mt-1 font-mono text-lg font-semibold ${
                  narration.summary.netPnL >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {narration.summary.netPnL >= 0 ? "+" : ""}${narration.summary.netPnL.toFixed(2)}
              </div>
            </div>
          </>
        ) : (
          /* Loading skeleton */
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center animate-pulse">
                <div className="h-3 w-10 mx-auto bg-white/10 rounded" />
                <div className="mt-2 h-6 w-8 mx-auto bg-white/10 rounded" />
              </div>
            ))}
          </>
        )}
      </div>

      {/* Legs - Plain language */}
      <div className="mt-4">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/40">
          Positions
        </div>
        {narration?.legs ? (
          <ul className="space-y-2">
            {narration.legs.map((leg) => (
              <li key={leg.marketId}>
                <PositionCard
                  position={{
                    symbol: leg.symbol,
                    side: leg.side as "YES" | "NO",
                    expiry: leg.expiry,
                    price: leg.price,
                    quantity: leg.filled,
                    interval: leg.interval,
                    outcome: leg.outcome,
                    payout: leg.payout,
                  }}
                  showCost={false}
                  showLiquidity={false}
                  showOutcome={true}
                  compact={true}
                />
              </li>
            ))}
          </ul>
        ) : (
          /* Loading skeleton for positions */
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-white/10 rounded-lg" />
                    <div>
                      <div className="h-4 w-32 bg-white/10 rounded" />
                      <div className="mt-1 h-3 w-20 bg-white/5 rounded" />
                    </div>
                  </div>
                  <div className="h-6 w-16 bg-white/10 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Redeem Button */}
      {canRedeem && !redeeming && (
        <button
          onClick={handleRedeem}
          className="mt-5 w-full rounded-xl bg-gradient-to-r from-green-500 to-green-600 px-4 py-3 text-sm font-semibold text-black shadow-lg shadow-green-500/25 transition-all hover:-translate-y-0.5 hover:shadow-green-500/40"
        >
          Redeem Positions
        </button>
      )}

      {/* Debug: Show redeemable count */}
      {narration?.legs && (
        <p className="mt-2 text-center text-[10px] text-white/30">
          {narration.legs.filter(l => l.redeemable).length} redeemable ·
          {narration.legs.filter(l => l.outcome === "won").length} won ·
          {narration.legs.filter(l => l.outcome === "voided").length} voided
        </p>
      )}

      {redeeming && (
        <div className="mt-5 flex items-center justify-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-orange-500" />
          <span className="text-sm text-white/60">{redeemProgress}</span>
        </div>
      )}

      {/* All settled with no wins */}
      {allSettled && !canRedeem && !redeeming && basket.status !== "redeemed" && (
        <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center">
          <p className="text-sm text-white/50">
            {narration?.summary?.losses === narration?.summary?.total
              ? "All positions lost — nothing to redeem."
              : "No winning positions to redeem."}
          </p>
          <p className="mt-2 text-xs text-white/30">
            Lost bets pay $0. Only winning or voided positions can be redeemed.
          </p>
        </div>
      )}

      {/* Next expiry countdown */}
      {narration?.summary?.minutesToNextExpiry != null &&
        narration?.summary?.minutesToNextExpiry > 0 && (
          <p className="mt-4 text-center text-xs text-white/40">
            Next position expires in <span className="font-medium text-orange-400">{narration?.summary?.minutesToNextExpiry}m</span>
          </p>
        )}
    </div>
  );
}
