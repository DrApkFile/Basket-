"use client";

import { useState, useEffect } from "react";

interface AssetStats {
  asset: string;
  sampleSize: number;
  voidedCount: number;
  upWinPct: number;
  downWinPct: number;
}

export default function BaseRateStats() {
  const [stats, setStats] = useState<AssetStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats/base-rate");
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setStats(data.stats || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
    // Refresh every 15 minutes (matches cache TTL)
    const interval = setInterval(fetchStats, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-white/30">
        <span className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white/50" />
        Loading historical rates...
      </div>
    );
  }

  if (error || stats.length === 0) {
    return null; // Fail silently - this is supplementary info
  }

  const btc = stats.find((s) => s.asset === "BTC");
  const eth = stats.find((s) => s.asset === "ETH");

  // Don't show if we don't have meaningful sample sizes
  if ((!btc || btc.sampleSize < 5) && (!eth || eth.sampleSize < 5)) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/40">
      <span className="text-white/25">Historical settlement rates:</span>
      {btc && btc.sampleSize >= 5 && (
        <span>
          <span className="font-medium text-white/50">BTC</span> settled Up{" "}
          <span className="text-white/60">{btc.upWinPct}%</span> of {btc.sampleSize - btc.voidedCount} windows
        </span>
      )}
      {btc && eth && btc.sampleSize >= 5 && eth.sampleSize >= 5 && (
        <span className="text-white/20">·</span>
      )}
      {eth && eth.sampleSize >= 5 && (
        <span>
          <span className="font-medium text-white/50">ETH</span>:{" "}
          <span className="text-white/60">{eth.upWinPct}%</span> of {eth.sampleSize - eth.voidedCount}
        </span>
      )}
    </div>
  );
}
