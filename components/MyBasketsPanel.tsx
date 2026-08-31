"use client";

import { useState } from "react";
import BasketDetail from "./BasketDetail";
import type { BasketDoc } from "@/lib/firestore-types";

interface UserBasket extends BasketDoc {
  id: string;
  legCount: number;
  pendingCount: number;
  settledCount: number;
  redeemableCount: number;
}

interface MyBasketsPanelProps {
  baskets: UserBasket[];
  loading: boolean;
  onRefresh: () => void;
}

export default function MyBasketsPanel({ baskets, loading, onRefresh }: MyBasketsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-white/6 bg-gradient-to-br from-white/[0.02] to-transparent p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">My Baskets</h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-orange-500" />
              Refreshing
            </span>
          ) : (
            "Refresh"
          )}
        </button>
      </div>

      {/* Empty State */}
      {baskets.length === 0 && !loading && (
        <div className="rounded-xl border border-white/5 bg-white/[0.01] p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/10 to-green-500/5">
            <span className="text-2xl">📦</span>
          </div>
          <p className="font-medium text-white/60">No baskets yet</p>
          <p className="mt-1 text-sm text-white/30">Create your first basket to get started</p>
        </div>
      )}

      {/* Loading */}
      {loading && baskets.length === 0 && (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-orange-500" />
        </div>
      )}

      {/* Baskets List */}
      <div className="space-y-3">
        {baskets.map((basket) => (
          <div key={basket.id}>
            {expandedId === basket.id ? (
              <BasketDetail basketId={basket.id} onClose={() => setExpandedId(null)} />
            ) : (
              <button
                onClick={() => setExpandedId(basket.id)}
                className="group w-full rounded-xl border border-white/6 bg-white/[0.02] p-5 text-left transition-all hover:border-orange-500/20 hover:bg-white/[0.04]"
              >
                {/* Top Row */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500/20 to-green-500/10 text-sm font-bold">
                      {basket.asset === "BTC" ? "₿" : basket.asset === "ETH" ? "Ξ" : "⚡"}
                    </div>
                    <span className="font-semibold">{basket.asset}</span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        basket.status === "redeemed"
                          ? "bg-green-500/15 text-green-400"
                          : basket.status === "settled"
                          ? "bg-blue-500/15 text-blue-400"
                          : "bg-yellow-500/15 text-yellow-400"
                      }`}
                    >
                      {basket.status}
                    </span>
                  </div>
                  <span className="text-xs text-white/30">{basket.legCount} legs</span>
                </div>

                {/* Stats */}
                <div className="flex gap-4 text-xs">
                  {basket.pendingCount > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />
                      <span className="text-yellow-400">{basket.pendingCount} pending</span>
                    </span>
                  )}
                  {basket.redeemableCount > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                      <span className="text-green-400">{basket.redeemableCount} redeemable</span>
                    </span>
                  )}
                  {basket.pendingCount === 0 && basket.redeemableCount === 0 && (
                    <span className="text-white/30">
                      {basket.status === "redeemed" ? "All redeemed" : "No action needed"}
                    </span>
                  )}
                </div>

                {/* Narration */}
                {basket.narration && (
                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-white/50">
                    {basket.narration}
                  </p>
                )}

                {/* Expand hint */}
                <div className="mt-3 flex justify-end">
                  <span className="text-xs font-medium text-orange-400 opacity-0 transition-opacity group-hover:opacity-100">
                    View Details →
                  </span>
                </div>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
