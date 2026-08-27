"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

interface DashboardTopBarProps {
  totalBaskets: number;
  totalPending: number;
  totalRedeemable: number;
}

export default function DashboardTopBar({
  totalBaskets,
  totalPending,
  totalRedeemable,
}: DashboardTopBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-white/10 bg-black/30 px-6 py-3">
      <div className="flex items-center gap-6">
        <Link href="/" className="font-display text-lg font-bold tracking-tight text-white hover:text-accent transition-colors">
          Basket
        </Link>

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
