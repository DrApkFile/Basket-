"use client";

import { useState, useEffect, useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import Link from "next/link";
import MarketDetailModal from "./MarketDetailModal";
import BasketModal from "./BasketModal";
import CommunityPanel from "./CommunityPanel";
import MyBasketsPanel from "./MyBasketsPanel";
import BaseRateStats from "./BaseRateStats";
import BalanceDisplay from "./BalanceDisplay";
import { AssetIcon } from "./icons";
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

  const fetchMarkets = useCallback(async () => {
    try {
      setLoading(true);
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
  }, []);

  useEffect(() => {
    fetchMarkets();
    // Poll markets every 20 seconds for faster expiry updates
    const interval = setInterval(fetchMarkets, 20000);
    return () => clearInterval(interval);
  }, [fetchMarkets]);

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
    // Poll baskets every 15 seconds for status updates
    const interval = setInterval(fetchUserBaskets, 15000);
    return () => clearInterval(interval);
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
          --accent-green: #00E28A;
          --accent-orange: #FF6B35;
          --accent-gradient: linear-gradient(135deg, var(--accent-orange), var(--accent-green));
          --glass-bg: linear-gradient(135deg, rgba(255, 107, 53, 0.08), rgba(0, 226, 138, 0.04));
          --glass-border: rgba(255, 255, 255, 0.08);
        }

        .dashboard {
          min-height: 100vh;
          background: #030305;
          color: #fff;
          font-family: Inter, -apple-system, sans-serif;
        }

        /* Glass Effect */
        .glass {
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: 16px;
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
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
          background: rgba(3, 3, 5, 0.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
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
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .dash-tabs {
          display: flex;
          gap: 4px;
          padding: 4px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
        }

        .dash-tab {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
          background: transparent;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 200ms;
        }

        .dash-tab:hover {
          color: rgba(255, 255, 255, 0.8);
        }

        .dash-tab.active {
          color: #000;
          background: var(--accent-gradient);
          box-shadow: 0 2px 12px rgba(255, 107, 53, 0.3);
        }

        .dash-header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .create-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          font-size: 14px;
          font-weight: 600;
          color: #000;
          background: var(--accent-gradient);
          border: none;
          border-radius: 12px;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(255, 107, 53, 0.35);
          transition: all 250ms;
        }

        .create-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(255, 107, 53, 0.45);
        }

        .create-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
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
          padding: 28px;
          border-radius: 20px;
        }

        .stat-label {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 32px;
          font-weight: 700;
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .stat-change {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 8px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 600;
          color: var(--accent-green);
          background: rgba(0, 226, 138, 0.1);
          border-radius: 6px;
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
          gap: 8px;
        }

        .filter-pill {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          cursor: pointer;
          transition: all 200ms;
        }

        .filter-pill:hover {
          color: rgba(255, 255, 255, 0.8);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .filter-pill.active {
          color: #fff;
          background: linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(0, 226, 138, 0.1));
          border-color: rgba(255, 107, 53, 0.3);
        }

        /* Market Grid */
        .market-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
        }

        .market-card {
          position: relative;
          padding: 24px;
          border-radius: 20px;
          cursor: pointer;
          transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
        }

        .market-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 30% 0%, rgba(255, 107, 53, 0.1), transparent 60%);
          opacity: 0;
          transition: opacity 300ms;
        }

        .market-card:hover {
          transform: translateY(-4px);
          border-color: rgba(255, 107, 53, 0.2);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
        }

        .market-card:hover::before {
          opacity: 1;
        }

        .market-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          position: relative;
        }

        .market-asset {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .market-asset-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(255, 107, 53, 0.2), rgba(0, 226, 138, 0.1));
          border-radius: 12px;
          font-size: 18px;
          font-weight: 700;
        }

        .market-asset-name {
          font-size: 18px;
          font-weight: 600;
        }

        .market-interval {
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          background: rgba(255, 255, 255, 0.06);
          border-radius: 6px;
        }

        .market-expiry {
          display: flex;
          align-items: center;
          gap: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          position: relative;
        }

        .market-expiry-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .market-expiry-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .market-expiry-value {
          font-size: 15px;
          font-weight: 600;
        }

        .market-expiry-value.urgent {
          color: var(--accent-orange);
        }

        .market-expiry-value.soon {
          color: #FFB800;
        }

        .market-trade-btn {
          margin-left: auto;
          padding: 10px 20px;
          font-size: 13px;
          font-weight: 600;
          color: #000;
          background: var(--accent-gradient);
          border: none;
          border-radius: 10px;
          cursor: pointer;
          opacity: 0;
          transform: translateY(4px);
          transition: all 200ms;
        }

        .market-card:hover .market-trade-btn {
          opacity: 1;
          transform: translateY(0);
        }

        /* Empty State */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 40px;
          text-align: center;
          border-radius: 20px;
        }

        .empty-icon {
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(255, 107, 53, 0.1), rgba(0, 226, 138, 0.05));
          border-radius: 24px;
          margin-bottom: 24px;
          font-size: 32px;
        }

        .empty-title {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .empty-desc {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
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
          border-radius: 50%;
          animation: spin 1s linear infinite;
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
            <BalanceDisplay />
            <ConnectButton />
          </div>
        </header>

        {/* Main */}
        <main className="dash-main">
          {activeTab === "markets" && (
            <>
              {/* Stats */}
              <div className="dash-hero">
                <div className="stat-card glass">
                  <div className="stat-label">Live Markets</div>
                  <div className="stat-value">{markets.length}</div>
                  <div className="stat-change">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 9V3M6 3L3 6M6 3L9 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    Active now
                  </div>
                </div>
                <div className="stat-card glass">
                  <div className="stat-label">Your Baskets</div>
                  <div className="stat-value">{userBaskets.length}</div>
                </div>
                <div className="stat-card glass">
                  <div className="stat-label">Pending Positions</div>
                  <div className="stat-value">
                    {userBaskets.reduce((sum, b) => sum + b.pendingCount, 0)}
                  </div>
                </div>
              </div>

              {/* Historical base rates */}
              <div style={{ marginBottom: "24px" }}>
                <BaseRateStats />
              </div>

              {/* Markets */}
              <div className="section-header">
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <h2 className="section-title">Live Markets</h2>
                  <button
                    onClick={fetchMarkets}
                    disabled={loading}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "32px",
                      height: "32px",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "8px",
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.5 : 1,
                      transition: "all 200ms",
                    }}
                    title="Refresh markets"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{
                        color: "rgba(255, 255, 255, 0.6)",
                        animation: loading ? "spin 1s linear infinite" : "none",
                      }}
                    >
                      <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                    </svg>
                  </button>
                </div>
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
                <div className="empty-state glass">
                  <div className="empty-icon">⚠️</div>
                  <h3 className="empty-title">Failed to Load Markets</h3>
                  <p className="empty-desc">{error}</p>
                  <button
                    onClick={fetchMarkets}
                    style={{
                      marginTop: "20px",
                      padding: "12px 28px",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#000",
                      background: "linear-gradient(135deg, #FF6B35, #00E28A)",
                      border: "none",
                      borderRadius: "10px",
                      cursor: "pointer",
                      transition: "all 200ms",
                    }}
                  >
                    Try Again
                  </button>
                </div>
              ) : filteredMarkets.length === 0 ? (
                <div className="empty-state glass">
                  <div className="empty-icon">📊</div>
                  <h3 className="empty-title">No Markets Available</h3>
                  <p className="empty-desc">Check back soon for new trading opportunities.</p>
                  <button
                    onClick={fetchMarkets}
                    style={{
                      marginTop: "20px",
                      padding: "12px 28px",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#000",
                      background: "linear-gradient(135deg, #FF6B35, #00E28A)",
                      border: "none",
                      borderRadius: "10px",
                      cursor: "pointer",
                      transition: "all 200ms",
                    }}
                  >
                    Refresh Markets
                  </button>
                </div>
              ) : (
                <div className="market-grid">
                  {filteredMarkets.map((market) => {
                    const isUrgent = market.expiresInMin < 5;
                    const isSoon = market.expiresInMin < 15;
                    return (
                      <div
                        key={market.id}
                        className="market-card glass"
                        onClick={() => setSelectedMarketId(market.id)}
                      >
                        <div className="market-header">
                          <div className="market-asset">
                            <div className="market-asset-icon">
                              <AssetIcon asset={market.asset} size={24} />
                            </div>
                            <span className="market-asset-name">{market.asset}</span>
                          </div>
                          <span className="market-interval">{market.interval}</span>
                        </div>

                        <div className="market-expiry">
                          <div className="market-expiry-item">
                            <span className="market-expiry-label">Expires in</span>
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
                          <button className="market-trade-btn">Trade</button>
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
