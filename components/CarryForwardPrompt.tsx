"use client";

import { useState, useEffect } from "react";
import { useWalletClient, usePublicClient } from "wagmi";
import { createExchange } from "@/lib/somnia";
import type { LegSide, LiquidityLabel } from "@/lib/firestore-types";

interface CarryForwardProposal {
  originalLeg: {
    marketId: string;
    symbol: string;
    side: LegSide;
    quantity: number;
    price: number;
    interval: string;
  };
  nextWindow: {
    marketId: string;
    symbol: string;
    expiry: number;
    currentPrice: number;
    liquidityLabel: LiquidityLabel;
  };
}

interface CarryForwardPromptProps {
  basketId: string;
  legMarketId: string;
  legSymbol: string;
  legSide: LegSide;
  legInterval: string;
  onComplete: () => void; // Called after approve or dismiss
}

export default function CarryForwardPrompt({
  basketId,
  legMarketId,
  legSymbol,
  legSide,
  legInterval,
  onComplete,
}: CarryForwardPromptProps) {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [checking, setChecking] = useState(true);
  const [eligible, setEligible] = useState(false);
  const [proposal, setProposal] = useState<CarryForwardProposal | null>(null);
  const [reason, setReason] = useState<string>("");

  const [placing, setPlacing] = useState(false);
  const [placeStatus, setPlaceStatus] = useState<string>("");
  const [dismissed, setDismissed] = useState(false);

  // Check eligibility on mount
  useEffect(() => {
    async function checkEligibility() {
      try {
        const res = await fetch("/api/basket/carry-forward", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            basketId,
            legMarketId,
            action: "check",
          }),
        });

        const data = await res.json();

        if (data.eligible && data.proposal) {
          setEligible(true);
          setProposal(data.proposal);
        } else {
          setEligible(false);
          setReason(data.reason || "Not eligible for carry-forward");
        }
      } catch (err) {
        setEligible(false);
        setReason("Failed to check carry-forward eligibility");
      } finally {
        setChecking(false);
      }
    }

    checkEligibility();
  }, [basketId, legMarketId]);

  // Mark leg as carriedForward (called after approve OR dismiss)
  async function markCarriedForward() {
    try {
      await fetch("/api/basket/carry-forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basketId,
          legMarketId,
          action: "mark",
        }),
      });
    } catch {
      // Non-fatal: worst case is user sees the prompt again
      console.warn("Failed to mark leg as carriedForward");
    }
  }

  async function handleDismiss() {
    setDismissed(true);
    await markCarriedForward();
    onComplete();
  }

  async function handleApprove() {
    if (!walletClient || !proposal) return;

    setPlacing(true);
    setPlaceStatus("Preparing order...");

    try {
      // Create exchange with wallet
      const exchange = createExchange();
      exchange.setSigner({ walletClient });

      // Build order
      const symbol = `${proposal.nextWindow.symbol}#${proposal.originalLeg.side}`;
      const quantity = proposal.originalLeg.quantity;
      const price = proposal.nextWindow.currentPrice;

      setPlaceStatus("Sign the transaction in your wallet...");

      // Place the order (same flow as normal basket)
      const result = await exchange.createOrder(
        symbol,
        "limit",
        "buy",
        quantity,
        price
      );

      if (!result.txHash) {
        throw new Error("No transaction hash returned");
      }

      setPlaceStatus("Waiting for confirmation...");

      // Wait for confirmation
      await publicClient?.waitForTransactionReceipt({
        hash: result.txHash as `0x${string}`,
      });

      setPlaceStatus("Carry-forward order placed successfully!");

      // Mark as carried forward
      await markCarriedForward();

      // Note: We don't add the new leg to the basket - this is a NEW order
      // in a different market. The user can track it separately or we could
      // extend this to add it to the same basket (future enhancement).

      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);

      if (errMsg.includes("user rejected") || errMsg.includes("User rejected")) {
        setPlaceStatus("Transaction cancelled");
      } else {
        setPlaceStatus(`Error: ${errMsg}`);
      }

      // Still mark as carried forward on error (one-time offer)
      await markCarriedForward();

      setTimeout(() => {
        setPlacing(false);
        onComplete();
      }, 3000);
    }
  }

  // Don't render if checking, not eligible, or dismissed
  if (checking || !eligible || dismissed) {
    return null;
  }

  if (!proposal) return null;

  // Format expiry time
  const expiryDate = new Date(proposal.nextWindow.expiry * 1000);
  const expiryTime = expiryDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const asset = proposal.originalLeg.symbol.split("-")[0];

  return (
    <div className="mt-3 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
      <div className="mb-2 flex items-center gap-2">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-yellow-400"
        >
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <span className="text-sm font-medium text-yellow-400">
          Carry Forward Available
        </span>
      </div>

      <p className="text-sm text-white/70">
        Your <span className="font-medium text-white">{asset} {legInterval}</span> position
        didn&apos;t fill. Carry it forward to the{" "}
        <span className="font-medium text-white">{expiryTime}</span> window?
      </p>

      <div className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs">
        <div className="flex justify-between">
          <span className="text-white/50">Side</span>
          <span className={proposal.originalLeg.side === "YES" ? "text-green-400" : "text-red-400"}>
            {proposal.originalLeg.side}
          </span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-white/50">Quantity</span>
          <span className="text-white/80">{proposal.originalLeg.quantity} contracts</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-white/50">Current Price</span>
          <span className="text-white/80">${proposal.nextWindow.currentPrice.toFixed(4)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-white/50">Liquidity</span>
          <span
            className={
              proposal.nextWindow.liquidityLabel === "deep"
                ? "text-green-400"
                : proposal.nextWindow.liquidityLabel === "thin"
                ? "text-yellow-400"
                : "text-red-400"
            }
          >
            {proposal.nextWindow.liquidityLabel}
          </span>
        </div>
      </div>

      {placing ? (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-white/5 p-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-yellow-400" />
          <span className="text-sm text-white/60">{placeStatus}</span>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleApprove}
            disabled={!walletClient}
            className="flex-1 rounded-lg bg-yellow-500/20 px-4 py-2 text-sm font-medium text-yellow-400 transition-all hover:bg-yellow-500/30 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-white/50 transition-all hover:bg-white/10 hover:text-white/70"
          >
            Dismiss
          </button>
        </div>
      )}

      <p className="mt-2 text-center text-[10px] text-white/30">
        Requires your wallet signature. One-time offer.
      </p>
    </div>
  );
}
