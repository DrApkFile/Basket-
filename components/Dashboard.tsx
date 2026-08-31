"use client";

import { useState, useEffect, useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import Link from "next/link";
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

type MarketFilter = "all" | "btc" | "eth";
type Tab = "markets" | "community" | "baskets";

export default function Dashboard() {
  const { address } = useAccount();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MarketFilter>("all");
  const [activeTab, setActiveTab] = useState<Tab>("markets");
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [isBasketModalOpen, setIsBasketModalOpen] = useState(false);
  const [userBaskets, setUserBaskets] = useState<UserBasket[]>([]);
  const [basketsLoading, setBasketsLoading] = useState(false);

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

  const filteredMarkets = markets.filter((m) => {
    if (filter === "btc") return m.asset === "BTC";
    if (filter === "eth") return m.asset === "ETH";
    return true;
  });

  const availableAssets = [...new Set(markets.map((m) => m.asset))];

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');

        :root {
          --accent-green: #00FF94;
          --accent-orange: #FF5722;
          --bg-dark: #0a0a0c;
        }

        .dashboard {
          min-height: 100vh;
          background: var(--bg-dark);
          color: #fff;
          font-family: Inter, -apple-system, sans-serif;
        }

        /* Animated Border Card */
        .border-card {
          position: relative;
          background: transparent;
          border: none;
          padding: 2px;
        }

        .border-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: conic-gradient(
            from 0deg,
            var(--accent-orange) 0deg,
            var(--accent-orange) 360deg
          );
          transition: none;
          z-index: -1;
        }

        .border-card::after {
          content: '';
          position: absolute;
          inset: 2px;
          background: var(--bg-dark);
          z-index: -1;
        }

        .border-card:hover::before,
        .border-card:active::before,
        .border-card.active::before {
          animation: border-sweep 0.6s ease forwards;
        }

        @keyframes border-sweep {
          0% {
            background: conic-gradient(
              from 0deg,
              var(--accent-green) 0deg,
              var(--accent-orange) 0deg,
              var(--accent-orange) 360deg
            );
          }
          25% {
            background: conic-gradient(
              from 0deg,
              var(--accent-green) 0deg,
              var(--accent-green) 90deg,
              var(--accent-orange) 90deg,
              var(--accent-orange) 360deg
            );
          }
          50% {
            background: conic-gradient(
              from 0deg,
              var(--accent-green) 0deg,
              var(--accent-green) 180deg,
              var(--accent-orange) 180deg,
              var(--accent-orange) 360deg
            );
          }
          75% {
            background: conic-gradient(
              from 0deg,
              var(--accent-green) 0deg,
              var(--accent-green) 270deg,
              var(--accent-orange) 270deg,
              var(--accent-orange) 360deg
            );
          }
          100% {
            background: conic-gradient(
              from 0deg,
              var(--accent-green) 0deg,
              var(--accent-green) 360deg
            );
          }
        }

        .border-card:not(:hover):not(:active):not(.active)::before {
          animation: border-sweep-reverse 0.6s ease forwards;
        }

        @keyframes border-sweep-reverse {
          0% {
            background: conic-gradient(
              from 0deg,
              var(--accent-orange) 0deg,
              var(--accent-green) 0deg,
              var(--accent-green) 360deg
            );
          }
          25% {
            background: conic-gradient(
              from 0deg,
              var(--accent-orange) 0deg,
              var(--accent-orange) 90deg,
              var(--accent-green) 90deg,
              var(--accent-green) 360deg
            );
          }
          50% {
            background: conic-gradient(
              from 0deg,
              var(--accent-orange) 0deg,
              var(--accent-orange) 180deg,
              var(--accent-green) 180deg,
              var(--accent-green) 360deg
            );
          }
          75% {
            background: conic-gradient(
              from 0deg,
              var(--accent-orange) 0deg,
              var(--accent-orange) 270deg,
              var(--accent-green) 270deg,
              var(--accent-green) 360deg
            );
          }
          100% {
            background: conic-gradient(
              from 0deg,
              var(--accent-orange) 0deg,
              var(--accent-orange) 360deg
            );
          }
        }

        .border-card-inner {
          background: var(--bg-dark);
          height: 100%;
        }

        /* Header */
        .dash-header {
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 32px;
          background: var(--bg-dark);
          border-bottom: 2px solid var(--accent-orange);
        }

        .dash-brand {
          display: flex;
          align-items: center;
          gap: 14px;
          text-decoration: none;
        }

        .dash-brand-name {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
        }

        .dash-tabs {
          display: flex;
          gap: 0;
          border: 2px solid var(--accent-orange);
        }

        .dash-tab {
          padding: 10px 24px;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.6);
          background: transparent;
          border: none;
          border-right: 2px solid var(--accent-orange);
          cursor: pointer;
          transition: all 200ms;
        }

        .dash-tab:last-child {
          border-right: none;
        }

        .dash-tab:hover {
          color: #fff;
          background: rgba(255, 87, 34, 0.1);
        }

        .dash-tab.active {
          color: #000;
          background: var(--accent-orange);
        }

        .dash-header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        /* Connect Wallet Button - Clear and Readable */
        .connect-btn-wrapper {
          position: relative;
          padding: 2px;
          background: var(--accent-orange);
          transition: background 0.4s ease;
        }

        .connect-btn-wrapper:hover {
          background: var(--accent-green);
        }

        .connect-btn-wrapper > div {
          background: var(--bg-dark) !important;
        }

        .connect-btn-wrapper button {
          background: transparent !important;
          border: none !important;
          color: #fff !important;
          font-weight: 600 !important;
          font-size: 14px !important;
          padding: 12px 20px !important;
        }

        .create-btn {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          font-size: 14px;
          font-weight: 700;
          color: #000;
          background: var(--accent-orange);
          border: none;
          cursor: pointer;
          transition: all 200ms;
        }

        .create-btn:hover {
          background: var(--accent-green);
        }

        .create-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Main Layout */
        .dash-main {
          padding: 32px;
          max-width: 1400px;
          margin: 0 auto;
        }

        /* Hero Stats */
        .dash-hero {
          display: flex;
          gap: 20px;
          margin-bottom: 40px;
        }

        .stat-card {
          flex: 1;
          position: relative;
          background: transparent;
        }

        .stat-card-border {
          position: absolute;
          inset: 0;
          background: var(--accent-orange);
          z-index: 0;
        }

        .stat-card-inner {
          position: relative;
          z-index: 1;
          margin: 2px;
          padding: 24px;
          background: var(--bg-dark);
        }

        .stat-label {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 36px;
          font-weight: 700;
          color: var(--accent-orange);
        }

        .stat-change {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 12px;
          font-size: 12px;
          font-weight: 600;
          color: var(--accent-green);
        }

        /* Markets Section */
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .section-title {
          font-size: 20px;
          font-weight: 600;
        }

        .filter-pills {
          display: flex;
          gap: 0;
          border: 2px solid var(--accent-orange);
        }

        .filter-pill {
          padding: 8px 20px;
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          background: transparent;
          border: none;
          border-right: 2px solid var(--accent-orange);
          cursor: pointer;
          transition: all 200ms;
        }

        .filter-pill:last-child {
          border-right: none;
        }

        .filter-pill:hover {
          color: #fff;
          background: rgba(255, 87, 34, 0.15);
        }

        .filter-pill.active {
          color: #000;
          background: var(--accent-orange);
        }

        /* Market Grid */
        .market-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }

        .market-card {
          position: relative;
          background: transparent;
          cursor: pointer;
          transition: transform 200ms;
        }

        .market-card-border {
          position: absolute;
          inset: 0;
          background: conic-gradient(from 0deg, var(--accent-orange) 0deg, var(--accent-orange) 360deg);
          transition: none;
          z-index: 0;
        }

        .market-card:hover .market-card-border,
        .market-card:active .market-card-border {
          animation: border-sweep 0.5s ease forwards;
        }

        .market-card:not(:hover):not(:active) .market-card-border {
          animation: border-sweep-reverse 0.5s ease forwards;
        }

        .market-card-inner {
          position: relative;
          z-index: 1;
          margin: 2px;
          padding: 24px;
          background: var(--bg-dark);
        }

        .market-card:hover {
          transform: translateY(-2px);
        }

        .market-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .market-asset {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .market-asset-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid var(--accent-orange);
          font-size: 20px;
          font-weight: 700;
          color: var(--accent-orange);
        }

        .market-asset-name {
          font-size: 20px;
          font-weight: 700;
        }

        .market-interval {
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 700;
          color: var(--accent-green);
          border: 2px solid var(--accent-green);
        }

        .market-expiry {
          display: flex;
          align-items: center;
          gap: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .market-expiry-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .market-expiry-label {
          font-size: 10px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.3);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .market-expiry-value {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
        }

        .market-expiry-value.urgent {
          color: #FF3D00;
        }

        .market-expiry-value.soon {
          color: var(--accent-orange);
        }

        .market-trade-btn {
          margin-left: auto;
          padding: 10px 24px;
          font-size: 13px;
          font-weight: 700;
          color: #000;
          background: var(--accent-orange);
          border: none;
          cursor: pointer;
          opacity: 0;
          transform: translateX(10px);
          transition: all 200ms;
        }

        .market-trade-btn:hover {
          background: var(--accent-green);
        }

        .market-card:hover .market-trade-btn {
          opacity: 1;
          transform: translateX(0);
        }

        /* Empty State */
        .empty-state {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 40px;
          text-align: center;
        }

        .empty-state-border {
          position: absolute;
          inset: 0;
          background: var(--accent-orange);
        }

        .empty-state-inner {
          position: relative;
          z-index: 1;
          margin: 2px;
          padding: 60px 40px;
          background: var(--bg-dark);
          width: calc(100% - 4px);
        }

        .empty-icon {
          width: 72px;
          height: 72px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid var(--accent-orange);
          margin: 0 auto 24px;
          font-size: 28px;
        }

        .empty-title {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .empty-desc {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.4);
        }

        /* Loading */
        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 80px;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top-color: var(--accent-orange);
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Baskets Tab */
        .baskets-content {
          max-width: 900px;
          margin: 0 auto;
        }

        @media (max-width: 768px) {
          .dash-header {
            padding: 12px 16px;
            flex-wrap: wrap;
            gap: 12px;
          }

          .dash-tabs {
            order: 3;
            width: 100%;
            justify-content: center;
          }

          .dash-main {
            padding: 20px 16px;
          }

          .dash-hero {
            flex-direction: column;
          }

          .market-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="dashboard">
        {/* Header */}
        <header className="dash-header">
          <Link href="/" className="dash-brand">
            <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
              <defs>
                <linearGradient id="dashLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF6B35" />
                  <stop offset="100%" stopColor="#00E28A" />
                </linearGradient>
              </defs>
              <circle cx="18" cy="18" r="18" fill="url(#dashLogoGrad)" />
              <path d="M18 8L11 15L18 13L25 15L18 8Z" fill="#000" />
              <path d="M11 15L18 22V13L11 15Z" fill="#000" fillOpacity="0.4" />
              <path d="M25 15L18 13V22L25 15Z" fill="#000" fillOpacity="0.7" />
              <path d="M18 22L11 15L9 22L18 28L27 22L25 15L18 22Z" fill="#000" />
            </svg>
            <span className="dash-brand-name">Basket</span>
          </Link>

          <div className="dash-tabs">
            <button
              className={`dash-tab ${activeTab === "markets" ? "active" : ""}`}
              onClick={() => setActiveTab("markets")}
            >
              Markets
            </button>
            <button
              className={`dash-tab ${activeTab === "community" ? "active" : ""}`}
              onClick={() => setActiveTab("community")}
            >
              Community
            </button>
            {address && (
              <button
                className={`dash-tab ${activeTab === "baskets" ? "active" : ""}`}
                onClick={() => setActiveTab("baskets")}
              >
                My Baskets
              </button>
            )}
          </div>

          <div className="dash-header-actions">
            <button
              className="create-btn"
              onClick={() => setIsBasketModalOpen(true)}
              disabled={!address}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              Create Basket
            </button>
            <div className="connect-btn-wrapper">
              <ConnectButton />
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="dash-main">
          {activeTab === "markets" && (
            <>
              {/* Stats */}
              <div className="dash-hero">
                <div className="stat-card">
                  <div className="stat-card-border" />
                  <div className="stat-card-inner">
                    <div className="stat-label">Live Markets</div>
                    <div className="stat-value">{markets.length}</div>
                    <div className="stat-change">
                      <span style={{ width: 8, height: 8, background: 'var(--accent-green)' }} />
                      Active now
                    </div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-border" />
                  <div className="stat-card-inner">
                    <div className="stat-label">Your Baskets</div>
                    <div className="stat-value">{userBaskets.length}</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-border" />
                  <div className="stat-card-inner">
                    <div className="stat-label">Pending</div>
                    <div className="stat-value">
                      {userBaskets.reduce((sum, b) => sum + b.pendingCount, 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Markets */}
              <div className="section-header">
                <h2 className="section-title">Live Markets</h2>
                <div className="filter-pills">
                  <button
                    className={`filter-pill ${filter === "all" ? "active" : ""}`}
                    onClick={() => setFilter("all")}
                  >
                    All
                  </button>
                  <button
                    className={`filter-pill ${filter === "btc" ? "active" : ""}`}
                    onClick={() => setFilter("btc")}
                  >
                    BTC
                  </button>
                  <button
                    className={`filter-pill ${filter === "eth" ? "active" : ""}`}
                    onClick={() => setFilter("eth")}
                  >
                    ETH
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="loading-state">
                  <div className="loading-spinner" />
                </div>
              ) : error ? (
                <div className="empty-state">
                  <div className="empty-state-border" />
                  <div className="empty-state-inner">
                    <div className="empty-icon">⚠️</div>
                    <h3 className="empty-title">Failed to Load Markets</h3>
                    <p className="empty-desc">{error}</p>
                  </div>
                </div>
              ) : filteredMarkets.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-border" />
                  <div className="empty-state-inner">
                    <div className="empty-icon">📊</div>
                    <h3 className="empty-title">No Markets Available</h3>
                    <p className="empty-desc">Check back soon for new trading opportunities.</p>
                  </div>
                </div>
              ) : (
                <div className="market-grid">
                  {filteredMarkets.map((market) => {
                    const isUrgent = market.expiresInMin < 5;
                    const isSoon = market.expiresInMin < 15;
                    return (
                      <div
                        key={market.id}
                        className="market-card"
                        onClick={() => setSelectedMarketId(market.id)}
                      >
                        <div className="market-card-border" />
                        <div className="market-card-inner">
                          <div className="market-header">
                            <div className="market-asset">
                              <div className="market-asset-icon">
                                {market.asset === "BTC" ? "₿" : "Ξ"}
                              </div>
                              <span className="market-asset-name">{market.asset}</span>
                            </div>
                            <span className="market-interval">{market.interval}</span>
                          </div>

                          <div className="market-expiry">
                            <div className="market-expiry-item">
                              <span className="market-expiry-label">Expires</span>
                              <span className={`market-expiry-value ${isUrgent ? "urgent" : isSoon ? "soon" : ""}`}>
                                {market.expiresInMin}m
                              </span>
                            </div>
                            <div className="market-expiry-item">
                              <span className="market-expiry-label">At</span>
                              <span className="market-expiry-value">
                                {new Date(market.expiry).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <button className="market-trade-btn">Trade →</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === "community" && <CommunityPanel />}

          {activeTab === "baskets" && address && (
            <div className="baskets-content">
              <MyBasketsPanel
                baskets={userBaskets}
                loading={basketsLoading}
                onRefresh={fetchUserBaskets}
              />
            </div>
          )}
        </main>

        {/* Modals */}
        {selectedMarketId && (
          <MarketDetailModal
            marketId={selectedMarketId}
            onClose={() => setSelectedMarketId(null)}
          />
        )}

        <BasketModal
          isOpen={isBasketModalOpen}
          onClose={() => setIsBasketModalOpen(false)}
          availableAssets={availableAssets}
          marketCount={markets.length}
          onBasketCreated={fetchUserBaskets}
        />
      </div>
    </>
  );
}
