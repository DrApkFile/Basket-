"use client";

import { useState } from "react";
import { toPlainLanguage, type PositionInput } from "@/lib/plain-language";
import type { LiquidityLabel } from "@/lib/firestore-types";

interface PositionCardProps {
  position: PositionInput & {
    cost?: number;
    liquidityNote?: string;
    liquidityLabel?: LiquidityLabel;
    outcome?: string;
    payout?: number;
  };
  showCost?: boolean;
  showLiquidity?: boolean;
  showOutcome?: boolean;
  compact?: boolean;
}

export default function PositionCard({
  position,
  showCost = true,
  showLiquidity = true,
  showOutcome = false,
  compact = false,
}: PositionCardProps) {
  const [showTechnical, setShowTechnical] = useState(false);
  const plain = toPlainLanguage(position);

  if (compact) {
    // Compact version for list views
    return (
      <div className="rounded bg-white/5 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-xs text-white/90">{plain.question}</p>
            <p className="mt-0.5 text-[10px] text-white/50">
              {plain.confidence} · {plain.windowLabel}
            </p>
          </div>
          {showOutcome && position.outcome && (
            <span
              className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${
                position.outcome === "won"
                  ? "bg-green-500/20 text-green-400"
                  : position.outcome === "lost"
                  ? "bg-red-500/20 text-red-400"
                  : position.outcome === "voided"
                  ? "bg-gray-500/20 text-gray-400"
                  : "bg-yellow-500/20 text-yellow-400"
              }`}
            >
              {position.outcome.toUpperCase()}
              {position.payout != null && position.payout > 0 && ` +$${position.payout.toFixed(2)}`}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Full version for proposal view
  return (
    <div className="rounded-lg bg-white/5 px-4 py-3">
      {/* Plain language question - primary */}
      <p className="text-sm font-medium text-white/90">{plain.question}</p>

      {/* Secondary details */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
        <span className="text-accent">{plain.confidence}</span>
        <span>{plain.windowLabel}</span>
        <span>{plain.contractsLabel}</span>
        {showCost && position.cost != null && (
          <span className="text-white/70">= ${position.cost.toFixed(2)}</span>
        )}
      </div>

      {/* Outcome badge if showing */}
      {showOutcome && position.outcome && (
        <div className="mt-2">
          <span
            className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${
              position.outcome === "won"
                ? "bg-green-500/20 text-green-400"
                : position.outcome === "lost"
                ? "bg-red-500/20 text-red-400"
                : position.outcome === "voided"
                ? "bg-gray-500/20 text-gray-400"
                : "bg-yellow-500/20 text-yellow-400"
            }`}
          >
            {position.outcome.toUpperCase()}
            {position.payout != null && position.payout > 0 && ` — Payout: $${position.payout.toFixed(2)}`}
          </span>
        </div>
      )}

      {/* Liquidity note */}
      {showLiquidity && position.liquidityNote && (
        <div
          className={`mt-2 rounded px-2 py-1 text-[10px] ${
            position.liquidityLabel === "deep"
              ? "bg-green-500/10 text-green-400"
              : position.liquidityLabel === "thin"
              ? "bg-yellow-500/10 text-yellow-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {position.liquidityNote}
        </div>
      )}

      {/* Technical details toggle */}
      <button
        onClick={() => setShowTechnical(!showTechnical)}
        className="mt-2 text-[10px] text-white/30 hover:text-white/50"
      >
        {showTechnical ? "▾ Hide technical" : "▸ Show technical"}
      </button>

      {showTechnical && (
        <div className="mt-1 rounded bg-black/30 px-2 py-1.5 font-mono text-[10px] text-white/40">
          <div>{position.symbol}#{position.side}</div>
          <div>
            {position.quantity} @ {position.price.toFixed(4)} | Interval: {position.interval || "—"}
          </div>
        </div>
      )}
    </div>
  );
}
