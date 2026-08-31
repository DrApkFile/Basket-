"use client";

import { useState, useEffect, useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import Link from "next/link";
import MarketCard from "./MarketCard";
import MarketDetailModal from "./MarketDetailModal";
import BasketModal from "./BasketModal";
import CommunityPanel from "./CommunityPanel";
import MyBasketsPanel from "./MyBasketsPanel";
import type { BasketDoc } from "@/lib/firestore-types";

interface Market {
  id: string;
  symbol: string;
  asset: string;
  interval: string;
  expiresInMin: number;
  expiry: string;
}

interface UserBasket extends BasketDoc {
  id: string;
  legCount: number;
  pendingCount: number;
  settledCount: number;
  redeemableCount: number;
}

type MarketFilter = "all" | "live" | "upcoming";
type Tab = "home" | "community" | "baskets";

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="white" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>
      <span className="font-display text-lg font-bold text-white">Basket</span>
    </div>
  );
}

export default function Dashboard() {
  const { address } = useAccount();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MarketFilter>("all");
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [isBasketModalOpen, setIsBasketModalOpen] = useState(false);
  const [userBaskets, setUserBaskets] = useState<UserBasket[]>([]);
  const [basketsLoading, setBasketsLoading] = useState(false);

  // Fetch markets
  useEffect(() => {
    async function fetchMarkets() {
      try {
        setError(null);
        const res = await fetch("/api/markets");
        if (!res.ok) throw new Error("Failed to load markets");
        const data = await res.json();
        setMarkets(data.markets || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }

    fetchMarkets();
    const interval = setInterval(fetchMarkets, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch user baskets
  const fetchUserBaskets = useCallback(async () => {
    if (!address) return;
    setBasketsLoading(true);
    try {
      const res = await fetch(`/api/basket/list?userId=${address}`);
      if (res.ok) {
        const data = await res.json();
        setUserBaskets(data.baskets || []);
      }
    } catch (err) {
      console.error("Failed to fetch baskets:", err);
    } finally {
      setBasketsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchUserBaskets();
  }, [fetchUserBaskets]);

  // Filter markets
  const filteredMarkets = markets.filter((m) => {
    if (filter === "live") return m.expiresInMin <= 30;
    if (filter === "upcoming") return m.expiresInMin > 30;
    return true;
  });

  // Get unique assets for modal
  const availableAssets = [...new Set(markets.map((m) => m.asset))];

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Navbar */}
      <header className="border-b border-white/5 bg-[#0a0a0f]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo />

          {/* Tabs */}
          <nav className="flex items-center gap-1 rounded-lg bg-white/5 p-1">
            <button
              onClick={() => setActiveTab("home")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "home"
                  ? "bg-red-600 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              Home
            </button>
            <button
              onClick={() => setActiveTab("community")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === "community"
                  ? "bg-red-600 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              Community
            </button>
            {address && (
              <button
                onClick={() => setActiveTab("baskets")}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "baskets"
                    ? "bg-red-600 text-white"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 01-8 0" />
                </svg>
                My Baskets
                {userBaskets.length > 0 && (
                  <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
                    {userBaskets.length}
                  </span>
                )}
              </button>
            )}
          </nav>

          <ConnectButton />
        </div>
      </header>

      {/* Content */}
      {activeTab === "home" && (
        <main className="mx-auto max-w-7xl px-6 py-8">
          {/* Title Section */}
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
              LIVE MARKETS
            </p>
            <h1 className="mt-2 flex items-center gap-3 text-3xl font-bold text-white">
              <span className="text-4xl">🏆</span>
              Crypto Price Predictions
            </h1>
            <p className="mt-2 text-white/50">
              Predict price movements in real time
            </p>
          </div>

          {/* Filters + Create Button */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex gap-2">
              {(["all", "live", "upcoming"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    filter === f
                      ? "bg-red-600 text-white"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsBasketModalOpen(true)}
              disabled={!address}
              className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              + Create Basket
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex h-64 items-center justify-center">
              <p className="text-sm text-white/40">Loading markets...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Markets Grid */}
          {!loading && !error && (
            <>
              {filteredMarkets.length === 0 ? (
                <div className="flex h-64 items-center justify-center">
                  <p className="text-sm text-white/40">No markets available</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredMarkets.map((market) => (
                    <MarketCard
                      key={market.id}
                      market={market}
                      onClick={() => setSelectedMarketId(market.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Market count */}
          {!loading && !error && filteredMarkets.length > 0 && (
            <p className="mt-6 text-center text-xs text-white/30">
              {filteredMarkets.length} market{filteredMarkets.length !== 1 ? "s" : ""} available
            </p>
          )}
        </main>
      )}

      {activeTab === "community" && (
        <div className="h-[calc(100vh-73px)]">
          <CommunityPanel />
        </div>
      )}

      {activeTab === "baskets" && address && (
        <div className="mx-auto max-w-4xl px-6 py-8">
          <MyBasketsPanel
            baskets={userBaskets}
            loading={basketsLoading}
            onRefresh={fetchUserBaskets}
          />
        </div>
      )}

      {/* Market Detail Modal */}
      {selectedMarketId && (
        <MarketDetailModal
          marketId={selectedMarketId}
          onClose={() => setSelectedMarketId(null)}
        />
      )}

      {/* Basket Creation Modal */}
      <BasketModal
        isOpen={isBasketModalOpen}
        onClose={() => setIsBasketModalOpen(false)}
        availableAssets={availableAssets}
        marketCount={markets.length}
        onBasketCreated={fetchUserBaskets}
      />
    </div>
  );
}
