"use client";

import { useState, useEffect, useCallback } from "react";
import { useWalletClient } from "wagmi";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createExchange } from "@/lib/somnia";
import type { BasketDoc, LegDoc } from "@/lib/firestore-types";
import PositionCard from "./PositionCard";

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
    filled: number;
    cost: number;
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
  const [basket, setBasket] = useState<(BasketDoc & { id: string }) | null>(null);
  const [narration, setNarration] = useState<NarrationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemProgress, setRedeemProgress] = useState("");

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
  const fetchNarration = useCallback(async () => {
    try {
      const res = await fetch("/api/basket/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basketId }),
      });
      if (res.ok) {
        const data = await res.json();
        setNarration(data);
      }
    } catch (err) {
      console.error("Narration fetch error:", err);
    }
  }, [basketId]);

  // Initial fetch and polling for pending baskets
  useEffect(() => {
    fetchNarration();

    // Poll every 30 seconds if there are pending legs
    const interval = setInterval(() => {
      if (narration?.summary?.pending && narration.summary.pending > 0) {
        fetchNarration();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchNarration, narration?.summary?.pending]);

  // Handle batch redemption
  async function handleRedeem() {
    if (!walletClient || !basket) return;

    setRedeeming(true);
    setRedeemProgress("Checking redeemable legs...");

    try {
      // Get redeemable legs from server
      const res = await fetch("/api/basket/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basketId,
          walletAddress: basket.userId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to get redeemable legs");
      }

      const { redeemableLegs, totalEstimatedPayout } = (await res.json()) as {
        redeemableLegs: RedeemableLeg[];
        totalEstimatedPayout: number;
      };

      if (redeemableLegs.length === 0) {
        setRedeemProgress("No legs to redeem");
        setTimeout(() => setRedeeming(false), 2000);
        return;
      }

      setRedeemProgress(`Redeeming ${redeemableLegs.length} legs (~$${totalEstimatedPayout.toFixed(2)})...`);

      // Create exchange with wallet for redemption
      const exchange = createExchange();
      exchange.setSigner({ walletClient });

      const redemptions: Array<{ marketId: string; txHash: string; outcome: "won" | "voided" }> = [];

      // Redeem each leg using unified API
      for (let i = 0; i < redeemableLegs.length; i++) {
        const leg = redeemableLegs[i];
        setRedeemProgress(`Redeeming ${i + 1}/${redeemableLegs.length}: ${leg.symbol}...`);

        try {
          // Construct full symbol for redemption
          const fullSymbol = `${leg.symbol}#${leg.side}`;

          // Use exchange.redeem() which handles outcome resolution automatically
          const result = await exchange.redeem(fullSymbol, leg.filled);

          redemptions.push({
            marketId: leg.marketId,
            txHash: result.hash ?? "",
            outcome: leg.estimatedPayout === leg.filled ? "won" : "voided",
          });
        } catch (err) {
          console.error(`Failed to redeem ${leg.symbol}:`, err);
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
      }

      setRedeemProgress(`Redeemed ${redemptions.length} legs!`);
      await fetchNarration(); // Refresh status
    } catch (err) {
      console.error("Redeem error:", err);
      setRedeemProgress(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setTimeout(() => setRedeeming(false), 3000);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 p-5 text-center">
        <p className="text-sm text-white/60">Loading basket...</p>
      </div>
    );
  }

  if (!basket) {
    return (
      <div className="rounded-xl border border-red-500/30 p-5 text-center">
        <p className="text-sm text-red-400">Basket not found</p>
      </div>
    );
  }

  const canRedeem = narration?.legs?.some((l) => l.redeemable) ?? false;
  const allSettled = narration?.summary?.pending === 0;

  return (
    <div className="rounded-xl border border-white/10 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-sm font-bold text-white/80">
            {basket.asset} BASKET
          </h3>
          <p className="mt-1 font-mono text-xs text-white/40">{basketId.slice(0, 8)}...</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              basket.status === "redeemed"
                ? "bg-green-500/20 text-green-400"
                : basket.status === "settled"
                ? "bg-blue-500/20 text-blue-400"
                : "bg-yellow-500/20 text-yellow-400"
            }`}
          >
            {basket.status.toUpperCase()}
          </span>
          {onClose && (
            <button onClick={onClose} className="text-white/40 hover:text-white/60">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* AI Narration */}
      {basket.narration && (
        <div className="mt-4 rounded-lg bg-white/5 p-3">
          <div className="text-xs font-bold text-white/60">AI MONITOR</div>
          <p className="mt-1 text-sm text-white/80">{basket.narration}</p>
        </div>
      )}

      {/* Summary Stats */}
      {narration?.summary && (
        <div className="mt-4 grid grid-cols-4 gap-3 text-center text-xs">
          <div className="rounded bg-white/5 p-2">
            <div className="text-white/40">Wins</div>
            <div className="font-mono text-green-400">{narration.summary.wins}</div>
          </div>
          <div className="rounded bg-white/5 p-2">
            <div className="text-white/40">Losses</div>
            <div className="font-mono text-red-400">{narration.summary.losses}</div>
          </div>
          <div className="rounded bg-white/5 p-2">
            <div className="text-white/40">Pending</div>
            <div className="font-mono text-yellow-400">{narration.summary.pending}</div>
          </div>
          <div className="rounded bg-white/5 p-2">
            <div className="text-white/40">Net P&L</div>
            <div
              className={`font-mono ${
                narration.summary.netPnL >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {narration.summary.netPnL >= 0 ? "+" : ""}
              ${narration.summary.netPnL.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Legs - Plain language */}
      {narration?.legs && (
        <div className="mt-4">
          <div className="text-xs font-bold text-white/60">POSITIONS</div>
          <ul className="mt-2 space-y-1.5">
            {narration.legs.map((leg) => (
              <li key={leg.marketId}>
                <PositionCard
                  position={{
                    symbol: leg.symbol,
                    side: leg.side as "YES" | "NO",
                    expiry: Math.floor(Date.now() / 1000), // Already expired/settled
                    price: leg.cost / leg.filled, // Reconstruct price
                    quantity: leg.filled,
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
        </div>
      )}

      {/* Redeem Button */}
      {canRedeem && !redeeming && (
        <button
          onClick={handleRedeem}
          className="mt-4 w-full rounded-full bg-green-600/20 px-4 py-2 text-sm font-semibold text-green-400 hover:bg-green-600/30"
        >
          REDEEM WINNING LEGS
        </button>
      )}

      {redeeming && (
        <div className="mt-4 rounded bg-white/5 p-3 text-center text-sm text-white/60">
          {redeemProgress}
        </div>
      )}

      {/* Next expiry countdown */}
      {narration?.summary?.minutesToNextExpiry != null &&
        narration?.summary?.minutesToNextExpiry > 0 && (
          <p className="mt-3 text-center text-xs text-white/40">
            Next leg expires in {narration?.summary?.minutesToNextExpiry} minutes
          </p>
        )}
    </div>
  );
}
