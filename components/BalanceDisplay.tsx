"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { createExchange } from "@/lib/somnia";

export default function BalanceDisplay() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!address) {
      setBalance(null);
      return;
    }

    setLoading(true);
    try {
      const exchange = createExchange();
      if (walletClient) {
        exchange.setSigner({ walletClient });
      }
      await exchange.loadMarkets();

      const balances = await exchange.fetchBalance();
      // tUSDC is the collateral token
      const usdcBalance = balances["tUSDC"]?.free ?? balances["USDC"]?.free ?? 0;
      setBalance(usdcBalance);
    } catch (err) {
      console.error("Failed to fetch balance:", err);
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [address, walletClient]);

  useEffect(() => {
    fetchBalance();
    // Refresh balance every 30 seconds
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  if (!address) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
      <span className="text-xs text-white/50">tUSDC:</span>
      {loading && balance === null ? (
        <span className="text-xs text-white/30">...</span>
      ) : balance !== null ? (
        <span className="font-mono text-sm font-medium text-green-400">
          ${balance.toFixed(2)}
        </span>
      ) : (
        <span className="text-xs text-white/30">--</span>
      )}
      <button
        onClick={fetchBalance}
        disabled={loading}
        className="text-white/30 hover:text-white/60 transition-colors disabled:opacity-50"
        title="Refresh balance"
      >
        <svg
          className={`w-3 h-3 ${loading ? "animate-spin" : ""}`}
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
      </button>
    </div>
  );
}
