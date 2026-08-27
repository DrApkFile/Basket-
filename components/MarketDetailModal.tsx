"use client";

import { useState, useEffect } from "react";
import { toPlainLanguage } from "@/lib/plain-language";

interface MarketDetail {
  id: string;
  symbol: string;
  asset: string;
  interval: string;
  expiry: string;
  expiryTimestamp: number;
  expiresIn: number;
  expiresInMin: number;
  upPrice: number;
  downPrice: number;
  orderBook: {
    bids: [number, number][];
    asks: [number, number][];
  };
  tradeCount: number;
  lastTradeAt: number | null;
  lastTradeAgo: number | null;
  depthScore: number;
  liquidityLabel: "deep" | "thin" | "stale";
  liquidityNote: string;
}

interface MarketDetailModalProps {
  marketId: string;
  onClose: () => void;
}

export default function MarketDetailModal({ marketId, onClose }: MarketDetailModalProps) {
  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDetail() {
      try {
        setError(null);
        const res = await fetch(`/api/markets/${marketId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setMarket(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [marketId]);

  // Get plain language text
  const plain = market
    ? toPlainLanguage({
        symbol: market.symbol,
        side: "YES",
        expiry: market.expiryTimestamp,
        price: market.upPrice,
        quantity: 1,
        interval: market.interval,
      })
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative mx-4 w-full max-w-md rounded-xl border border-white/10 bg-[#0a0a0f] p-5 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-white/40 hover:text-white/70"
        >
          ✕
        </button>

        {/* Loading */}
        {loading && (
          <div className="py-12 text-center">
            <p className="text-sm text-white/60">Loading market data...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="py-8 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 text-xs text-white/40 underline"
            >
              Close
            </button>
          </div>
        )}

        {/* Market Detail */}
        {market && plain && (
          <>
            {/* Header - Plain language question */}
            <div className="pr-8">
              <p className="text-base font-medium text-white">{plain.question}</p>
              <p className="mt-1 text-xs text-white/50">
                {plain.windowLabel} · Expires {plain.confidence.replace("market confidence", "implied")}
              </p>
            </div>

            {/* Prices */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-green-500/10 p-3 text-center">
                <div className="text-[10px] font-bold text-green-400/70">UP / YES</div>
                <div className="mt-1 font-mono text-xl text-green-400">
                  {(market.upPrice * 100).toFixed(1)}%
                </div>
                <div className="mt-0.5 text-[10px] text-white/40">
                  ${market.upPrice.toFixed(4)}
                </div>
              </div>
              <div className="rounded-lg bg-red-500/10 p-3 text-center">
                <div className="text-[10px] font-bold text-red-400/70">DOWN / NO</div>
                <div className="mt-1 font-mono text-xl text-red-400">
                  {(market.downPrice * 100).toFixed(1)}%
                </div>
                <div className="mt-0.5 text-[10px] text-white/40">
                  ${market.downPrice.toFixed(4)}
                </div>
              </div>
            </div>

            {/* Order Book */}
            <div className="mt-4">
              <div className="text-[10px] font-bold text-white/50">ORDER BOOK (YES)</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                {/* Bids */}
                <div>
                  <div className="mb-1 text-white/30">BIDS</div>
                  {market.orderBook.bids.length === 0 ? (
                    <div className="text-white/20">No bids</div>
                  ) : (
                    market.orderBook.bids.map(([price, qty], i) => (
                      <div key={i} className="flex justify-between text-green-400/80">
                        <span>{qty.toFixed(0)}</span>
                        <span>{price.toFixed(4)}</span>
                      </div>
                    ))
                  )}
                </div>
                {/* Asks */}
                <div>
                  <div className="mb-1 text-white/30">ASKS</div>
                  {market.orderBook.asks.length === 0 ? (
                    <div className="text-white/20">No asks</div>
                  ) : (
                    market.orderBook.asks.map(([price, qty], i) => (
                      <div key={i} className="flex justify-between text-red-400/80">
                        <span>{price.toFixed(4)}</span>
                        <span>{qty.toFixed(0)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Liquidity */}
            <div className="mt-4">
              <div
                className={`rounded px-3 py-2 text-xs ${
                  market.liquidityLabel === "deep"
                    ? "bg-green-500/10 text-green-400"
                    : market.liquidityLabel === "thin"
                    ? "bg-yellow-500/10 text-yellow-400"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                {market.liquidityNote}
              </div>
            </div>

            {/* Time & Technical Details */}
            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-white/40">Time remaining</span>
                <span className="font-mono text-white">
                  {market.expiresInMin < 60
                    ? `${market.expiresInMin}m`
                    : `${Math.floor(market.expiresInMin / 60)}h ${market.expiresInMin % 60}m`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Expires</span>
                <span className="text-white/70">
                  {new Date(market.expiry).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Raw symbol - demoted */}
            <div className="mt-4 rounded bg-white/5 px-3 py-2">
              <div className="text-[9px] text-white/30">TECHNICAL SYMBOL</div>
              <div className="mt-0.5 font-mono text-[10px] text-white/50">
                {market.symbol}
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-white/30">
                ID: {market.id}
              </div>
            </div>

            {/* Read-only notice */}
            <p className="mt-4 text-center text-[9px] text-white/20">
              This is a read-only view. To trade, use the AI Basket Constructor.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
