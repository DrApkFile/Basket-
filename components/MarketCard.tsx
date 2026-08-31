"use client";

interface MarketCardProps {
  market: {
    id: string;
    symbol: string;
    asset: string;
    interval: string;
    expiresInMin: number;
    expiry: string;
  };
  onClick: () => void;
}

export default function MarketCard({ market, onClick }: MarketCardProps) {
  const isUrgent = market.expiresInMin < 5;
  const isSoon = market.expiresInMin < 15;

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition-all hover:border-red-500/30 hover:bg-white/[0.06]"
    >
      {/* Asset Badge */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-lg font-bold text-white">{market.asset}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            isUrgent
              ? "bg-red-500/20 text-red-400"
              : isSoon
              ? "bg-yellow-500/20 text-yellow-400"
              : "bg-white/10 text-white/60"
          }`}
        >
          {market.expiresInMin}m
        </span>
      </div>

      {/* Interval */}
      <p className="mt-2 text-xs text-white/40">{market.interval} window</p>

      {/* Expiry */}
      <p className="mt-auto pt-4 text-[10px] text-white/30">
        Expires {new Date(market.expiry).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </p>

      {/* Hover indicator */}
      <div className="absolute bottom-3 right-3 text-xs text-red-400 opacity-0 transition-opacity group-hover:opacity-100">
        Trade →
      </div>
    </button>
  );
}
