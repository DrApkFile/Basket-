"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

interface DashboardTopBarProps {
  totalBaskets: number;
  totalPending: number;
  totalRedeemable: number;
  activeTab?: "constructor" | "community";
  onTabChange?: (tab: "constructor" | "community") => void;
}

export default function DashboardTopBar({
  totalBaskets,
  totalPending,
  totalRedeemable,
  activeTab = "constructor",
  onTabChange,
}: DashboardTopBarProps) {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between border-b border-white/10 bg-black/30 px-6 py-3">
      <div className="flex items-center gap-6">
        {/* Back to Home */}
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-white hover:text-accent transition-colors"
        >
          <span className="text-white/40 text-sm">←</span>
          Basket
        </Link>

        {/* Tabs */}
        {onTabChange && (
          <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1">
            <button
              onClick={() => onTabChange("constructor")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                activeTab === "constructor"
                  ? "bg-accent/20 text-accent"
                  : "text-white/50 hover:text-white/70"
              }`}
            >
              Constructor
            </button>
            <button
              onClick={() => onTabChange("community")}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                activeTab === "community"
                  ? "bg-accent/20 text-accent"
                  : "text-white/50 hover:text-white/70"
              }`}
            >
              Community
            </button>
          </div>
        )}

        {/* Summary Stats */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-white/40">Baskets:</span>
            <span className="font-mono text-white">{totalBaskets}</span>
          </div>
          {totalPending > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-yellow-400">{totalPending} pending</span>
            </div>
          )}
          {totalRedeemable > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              <span className="text-green-400">{totalRedeemable} redeemable</span>
            </div>
          )}
        </div>
      </div>

      <ConnectButton showBalance={false} />
    </header>
  );
}
