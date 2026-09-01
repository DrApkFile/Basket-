"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AssetIcon, LoomIcon } from "./icons";

interface CommunityBasket {
  id: string;
  asset: string;
  totalSpent: number;
  legCount: number;
  status: string;
  createdAt: string;
  creatorWallet: string;
  creatorDisplay: string;
}

type AssetFilter = "all" | "BTC" | "ETH" | "BTC+ETH";

export default function CommunityPanel() {
  const [baskets, setBaskets] = useState<CommunityBasket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AssetFilter>("all");

  const fetchCommunityBaskets = useCallback(async () => {
    setLoading(true);
    setError(null);
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
  }, []);

  useEffect(() => {
    fetchCommunityBaskets();
  }, [fetchCommunityBaskets]);

  const filteredBaskets = baskets.filter((b) => {
    if (filter === "all") return true;
    return b.asset === filter || b.asset === "BTC + ETH";
  });

  const availableAssets = [...new Set(baskets.map((b) => b.asset))];

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return "Recently";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500/20 to-green-500/10">
            <span className="text-xl">🌐</span>
          </div>
          <h1 className="text-2xl font-bold">Community Baskets</h1>
        </div>
        <p className="text-white/50">
          Explore baskets shared by other traders. View strategies and copy winning approaches.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-sm text-white/40">Filter by:</span>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
              filter === "all"
                ? "bg-gradient-to-r from-orange-500/15 to-green-500/10 border-orange-500/30 text-white"
                : "bg-white/[0.02] border-white/6 text-white/50 hover:border-white/10 hover:text-white/70"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("BTC")}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all flex items-center gap-2 ${
              filter === "BTC"
                ? "bg-gradient-to-r from-orange-500/15 to-green-500/10 border-orange-500/30 text-white"
                : "bg-white/[0.02] border-white/6 text-white/50 hover:border-white/10 hover:text-white/70"
            }`}
          >
            <AssetIcon asset="BTC" size={16} />
            BTC
          </button>
          <button
            onClick={() => setFilter("ETH")}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all flex items-center gap-2 ${
              filter === "ETH"
                ? "bg-gradient-to-r from-orange-500/15 to-green-500/10 border-orange-500/30 text-white"
                : "bg-white/[0.02] border-white/6 text-white/50 hover:border-white/10 hover:text-white/70"
            }`}
          >
            <AssetIcon asset="ETH" size={16} />
            ETH
          </button>
          <button
            onClick={() => setFilter("BTC+ETH")}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all flex items-center gap-2 ${
              filter === "BTC+ETH"
                ? "bg-gradient-to-r from-orange-500/15 to-green-500/10 border-orange-500/30 text-white"
                : "bg-white/[0.02] border-white/6 text-white/50 hover:border-white/10 hover:text-white/70"
            }`}
          >
            <span className="flex -space-x-1">
              <AssetIcon asset="BTC" size={14} />
              <AssetIcon asset="ETH" size={14} />
            </span>
            Cross
          </button>
        </div>

        {/* Refresh */}
        <button
          onClick={fetchCommunityBaskets}
          disabled={loading}
          className="ml-auto flex items-center gap-2 px-3 py-2 text-sm text-white/50 hover:text-white/70 transition-colors disabled:opacity-50"
        >
          <svg
            className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      {!loading && baskets.length > 0 && (
        <div className="mb-6 flex items-center gap-6 text-sm text-white/40">
          <span>{baskets.length} shared basket{baskets.length !== 1 ? "s" : ""}</span>
          {filteredBaskets.length !== baskets.length && (
            <span>• Showing {filteredBaskets.length}</span>
          )}
          {availableAssets.length > 0 && (
            <span>• Assets: {availableAssets.join(", ")}</span>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <LoomIcon size={48} active style={{ color: "#FF6B35" }} />
          <p className="mt-4 text-white/50">Loading community baskets...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
            <span className="text-3xl">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold text-red-400">Failed to Load</h3>
          <p className="mt-2 text-sm text-white/50">{error}</p>
          <button
            onClick={fetchCommunityBaskets}
            className="mt-6 px-6 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredBaskets.length === 0 && (
        <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-16 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/10 to-green-500/5">
            <span className="text-4xl">
              {filter !== "all" ? "🔍" : "🌐"}
            </span>
          </div>
          <h3 className="text-lg font-semibold">
            {filter !== "all"
              ? `No ${filter} Baskets Found`
              : "No Shared Baskets Yet"}
          </h3>
          <p className="mt-2 text-sm text-white/40 max-w-md mx-auto">
            {filter !== "all"
              ? `No one has shared a ${filter} basket yet. Be the first to create and share one!`
              : "Create a basket and share it with the community to be the first!"}
          </p>
          {filter !== "all" && (
            <button
              onClick={() => setFilter("all")}
              className="mt-6 px-6 py-2 bg-white/5 border border-white/10 rounded-lg text-white/70 hover:bg-white/10 transition-colors"
            >
              Show All Baskets
            </button>
          )}
        </div>
      )}

      {/* Baskets Grid */}
      {!loading && !error && filteredBaskets.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBaskets.map((basket) => (
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
                      <AssetIcon asset={basket.asset.split(" ")[0]} size={24} />
                    </div>
                    <span className="font-semibold">{basket.asset}</span>
                  </div>
                  <span
                    className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                      basket.status === "active"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : basket.status === "settled"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-white/5 text-white/40"
                    }`}
                  >
                    {basket.status}
                  </span>
                </div>

                {/* Creator */}
                <div className="mb-4 flex items-center gap-2 text-sm">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/5">
                    <svg className="w-3 h-3 text-white/40" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-white/50 font-mono text-xs">
                    {basket.creatorDisplay}
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
                    {formatTimeAgo(basket.createdAt)}
                  </span>
                  <span className="text-xs font-medium text-orange-400 opacity-0 transition-opacity group-hover:opacity-100">
                    View Details →
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
