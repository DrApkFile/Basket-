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
      <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-white/85">{plain.question}</p>
            <p className="mt-1 text-xs text-white/40">
              {plain.confidence} · {plain.windowLabel}
            </p>
          </div>
          {showOutcome && position.outcome && (
            <span
              className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                position.outcome === "won"
                  ? "bg-green-500/15 text-green-400"
                  : position.outcome === "lost"
                  ? "bg-red-500/15 text-red-400"
                  : position.outcome === "voided"
                  ? "bg-white/10 text-white/50"
                  : "bg-yellow-500/15 text-yellow-400"
              }`}
            >
              {position.outcome.toUpperCase()}
              {position.payout != null && position.payout > 0 && (
                <span className="ml-1 text-green-400">+${position.payout.toFixed(2)}</span>
              )}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Full version for proposal view
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      {/* Plain language question - primary */}
      <p className="text-sm font-medium text-white/85">{plain.question}</p>

      {/* Secondary details */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-orange-400">{plain.confidence}</span>
        <span className="text-white/40">{plain.windowLabel}</span>
        <span className="text-white/40">{plain.contractsLabel}</span>
        {showCost && position.cost != null && (
          <span className="font-medium text-white/60">= ${position.cost.toFixed(2)}</span>
        )}
      </div>

      {/* Outcome badge if showing */}
      {showOutcome && position.outcome && (
        <div className="mt-3">
          <span
            className={`inline-block rounded-lg px-3 py-1 text-xs font-semibold ${
              position.outcome === "won"
                ? "bg-green-500/15 text-green-400"
                : position.outcome === "lost"
                ? "bg-red-500/15 text-red-400"
                : position.outcome === "voided"
                ? "bg-white/10 text-white/50"
                : "bg-yellow-500/15 text-yellow-400"
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
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${
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
        className="mt-3 flex items-center gap-1 text-xs text-white/30 transition-colors hover:text-white/50"
      >
        <span>{showTechnical ? "▾" : "▸"}</span>
        <span>{showTechnical ? "Hide" : "Show"} technical</span>
      </button>

      {showTechnical && (
        <div className="mt-2 rounded-lg border border-white/5 bg-black/30 px-3 py-2 font-mono text-[11px] text-white/40">
          <div>{position.symbol}#{position.side}</div>
          <div className="mt-1">
            {position.quantity} @ {position.price.toFixed(4)} | Interval: {position.interval || "—"}
          </div>
        </div>
      )}
    </div>
  );
}
