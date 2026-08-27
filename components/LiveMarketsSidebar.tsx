"use client";

import { useState, useEffect } from "react";
import MarketDetailModal from "./MarketDetailModal";

interface LiveMarket {
  id: string;
  symbol: string;
  base: string;
  asset: string;
  interval: string;
  expiry: string;
  expiresIn: number;
  expiresInMin: number;
}

interface LiveMarketsSidebarProps {
  onMarketHint?: (asset: string) => void;
}

export default function LiveMarketsSidebar({ onMarketHint }: LiveMarketsSidebarProps) {
  const [markets, setMarkets] = useState<LiveMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "BTC" | "ETH">("all");
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMarkets() {
      try {
        setError(null);
        const res = await fetch("/api/markets");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setMarkets(data.markets || []);
      } catch (err) {
        console.error("Failed to fetch markets:", err);
        setError(err instanceof Error ? err.message : "Failed to load markets");
      } finally {
        setLoading(false);
      }
    }

    fetchMarkets();
    // Refresh every 60 seconds (indexer can be slow/unstable)
    const interval = setInterval(fetchMarkets, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredMarkets = filter === "all"
    ? markets
    : markets.filter(m => m.asset === filter);

  // Group by interval
  const grouped = filteredMarkets.reduce((acc, m) => {
    const key = m.interval;
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {} as Record<string, LiveMarket[]>);

  const intervalOrder = ["1m", "5m", "15m", "1h", "4h", "24h"];
  const sortedIntervals = Object.keys(grouped).sort(
    (a, b) => intervalOrder.indexOf(a) - intervalOrder.indexOf(b)
  );

  return (
    <aside className="h-full overflow-y-auto border-r border-white/10 bg-black/20 p-4">
      <h2 className="font-display text-xs font-bold tracking-wide text-white/60">
        LIVE MARKETS
      </h2>

      {/* Filter */}
      <div className="mt-3 flex gap-1">
        {(["all", "BTC", "ETH"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
              filter === f
                ? "bg-accent/20 text-accent"
                : "bg-white/5 text-white/40 hover:bg-white/10"
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {loading && (
        <p className="mt-4 text-xs text-white/40">Loading markets...</p>
      )}

      {error && (
        <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 px-2 py-2 text-xs text-red-400">
          <p className="font-semibold">Failed to load</p>
          <p className="mt-1 text-[10px] text-red-400/70">{error}</p>
        </div>
      )}

      {!loading && !error && filteredMarkets.length === 0 && (
        <p className="mt-4 text-xs text-white/40">No markets available</p>
      )}

      {/* Markets by interval */}
      <div className="mt-4 space-y-4">
        {sortedIntervals.map((interval) => (
          <div key={interval}>
            <div className="mb-1 text-[10px] font-bold text-white/30">
              {interval} WINDOWS
            </div>
            <ul className="space-y-1">
              {grouped[interval].map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => setSelectedMarketId(m.id)}
                    className="w-full rounded bg-white/5 px-2 py-1.5 text-left hover:bg-white/10"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-accent">
                        {m.asset}
                      </span>
                      <span
                        className={`text-[10px] ${
                          m.expiresInMin < 5
                            ? "text-red-400"
                            : m.expiresInMin < 15
                            ? "text-yellow-400"
                            : "text-white/40"
                        }`}
                      >
                        {m.expiresInMin}m
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-6 text-[9px] text-white/20">
        Click a market to view details.
      </p>

      {/* Market Detail Modal */}
      {selectedMarketId && (
        <MarketDetailModal
          marketId={selectedMarketId}
          onClose={() => setSelectedMarketId(null)}
        />
      )}
    </aside>
  );
}
