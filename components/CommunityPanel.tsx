"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AssetIcon } from "./icons";

interface CommunityBasket {
  id: string;
  asset: string;
  totalSpent: number;
  legCount: number;
  status: string;
  createdAt: string;
}

export default function CommunityPanel() {
  const [baskets, setBaskets] = useState<CommunityBasket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCommunityBaskets() {
      try {
        const res = await fetch("/api/basket/community");
        if (!res.ok) throw new Error("Failed to load community baskets");
        const data = await res.json();
        setBaskets(data.baskets || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchCommunityBaskets();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Community Baskets</h1>
        <p className="mt-2 text-white/50">
          Explore shared baskets from other traders. Copy any basket to start building your own.
        </p>
      </div>

      {baskets.length === 0 ? (
        <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-16 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/10 to-green-500/5">
            <span className="text-4xl">🌐</span>
          </div>
          <h3 className="text-lg font-semibold">No Shared Baskets Yet</h3>
          <p className="mt-2 text-sm text-white/40">
            Create a basket and share it with the community to be the first!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {baskets.map((basket) => (
            <Link
              key={basket.id}
              href={`/basket/${basket.id}`}
              className="group relative rounded-2xl border border-white/6 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-orange-500/20 hover:shadow-lg hover:shadow-orange-500/5"
            >
              {/* Hover glow */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

              <div className="relative">
                {/* Header */}
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-green-500/10">
                      <AssetIcon asset={basket.asset} size={24} />
                    </div>
                    <span className="font-semibold">{basket.asset}</span>
                  </div>
                  <span
                    className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                      basket.status === "active"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : "bg-white/5 text-white/40"
                    }`}
                  >
                    {basket.status}
                  </span>
                </div>

                {/* Stats */}
                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-white/40">Spent</div>
                    <div className="font-mono text-lg font-semibold text-orange-400">
                      ${basket.totalSpent.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-white/40">Windows</div>
                    <div className="font-mono text-lg font-semibold">{basket.legCount}</div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  <span className="text-xs text-white/30">
                    {basket.createdAt
                      ? new Date(basket.createdAt).toLocaleDateString()
                      : "Recently"}
                  </span>
                  <span className="text-xs font-medium text-orange-400 opacity-0 transition-opacity group-hover:opacity-100">
                    View & Copy →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
