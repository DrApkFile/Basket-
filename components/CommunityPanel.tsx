"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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
        if (!res.ok) {
          throw new Error("Failed to load community baskets");
        }
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
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-white/40">Loading community baskets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-xl font-bold text-white">Community Baskets</h1>
        <p className="mt-1 text-sm text-white/50">
          Explore baskets created by other traders. Copy any basket to use as a starting point for
          your own.
        </p>

        {baskets.length === 0 ? (
          <div className="mt-12 text-center">
            <p className="text-white/40">No community baskets yet</p>
            <p className="mt-1 text-xs text-white/30">
              Create a basket and share it to be the first!
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {baskets.map((basket) => (
              <Link
                key={basket.id}
                href={`/basket/${basket.id}`}
                className="group rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-accent/30 hover:bg-white/10"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-accent">{basket.asset}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      basket.status === "redeemed"
                        ? "bg-green-500/20 text-green-400"
                        : basket.status === "settled"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {basket.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-white/40">Spent</span>
                    <p className="font-mono text-white">${basket.totalSpent.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-white/40">Windows</span>
                    <p className="font-mono text-white">{basket.legCount}</p>
                  </div>
                </div>

                <p className="mt-3 text-[10px] text-white/30">
                  {basket.createdAt
                    ? new Date(basket.createdAt).toLocaleDateString()
                    : "Recently created"}
                </p>

                <div className="mt-3 flex items-center justify-end text-xs text-accent opacity-0 transition-opacity group-hover:opacity-100">
                  View & Copy →
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
