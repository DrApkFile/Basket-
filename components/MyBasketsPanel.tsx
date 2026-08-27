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

export default function MyBasketsPanel({
  baskets,
  loading,
  onRefresh,
}: MyBasketsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <aside className="h-full overflow-y-auto border-l border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xs font-bold tracking-wide text-white/60">
          MY BASKETS
        </h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-[10px] text-accent hover:underline disabled:opacity-50"
        >
          {loading ? "..." : "↻"}
        </button>
      </div>

      {baskets.length === 0 && !loading && (
        <div className="mt-8 text-center">
          <p className="text-xs text-white/40">No baskets yet</p>
          <p className="mt-1 text-[10px] text-white/20">
            Create your first basket using the constructor
          </p>
        </div>
      )}

      {loading && baskets.length === 0 && (
        <p className="mt-4 text-xs text-white/40">Loading...</p>
      )}

      {/* Basket List */}
      <ul className="mt-4 space-y-2">
        {baskets.map((b) => (
          <li key={b.id}>
            {expandedId === b.id ? (
              <BasketDetail
                basketId={b.id}
                onClose={() => setExpandedId(null)}
              />
            ) : (
              <button
                onClick={() => setExpandedId(b.id)}
                className="w-full rounded-lg bg-white/5 px-3 py-2 text-left hover:bg-white/10"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-accent">{b.asset}</span>
                    <span
                      className={`rounded px-1 py-0.5 text-[9px] ${
                        b.status === "redeemed"
                          ? "bg-green-500/20 text-green-400"
                          : b.status === "settled"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                  <span className="text-[10px] text-white/30">{b.legCount} legs</span>
                </div>

                {/* Quick stats */}
                <div className="mt-1 flex gap-2 text-[9px]">
                  {b.pendingCount > 0 && (
                    <span className="text-yellow-400">{b.pendingCount} pending</span>
                  )}
                  {b.redeemableCount > 0 && (
                    <span className="text-green-400">{b.redeemableCount} redeemable</span>
                  )}
                  {b.pendingCount === 0 && b.redeemableCount === 0 && (
                    <span className="text-white/30">
                      {b.status === "redeemed" ? "All redeemed" : "No action needed"}
                    </span>
                  )}
                </div>

                {/* Narration preview */}
                {b.narration && (
                  <p className="mt-1.5 text-[10px] text-white/50 line-clamp-2">
                    {b.narration}
                  </p>
                )}
              </button>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
