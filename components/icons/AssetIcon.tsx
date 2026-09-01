"use client";

import Image from "next/image";

interface AssetIconProps {
  asset: string;
  size?: number;
  className?: string;
}

/**
 * AssetIcon - Displays the appropriate icon for a crypto asset.
 * Uses actual asset logos for BTC and ETH, fallback for others.
 */
export function AssetIcon({ asset, size = 24, className }: AssetIconProps) {
  const normalizedAsset = asset.toUpperCase();

  if (normalizedAsset === "BTC" || normalizedAsset.includes("BTC")) {
    return (
      <Image
        src="/btc.png"
        alt="BTC"
        width={size}
        height={size}
        className={className}
      />
    );
  }

  if (normalizedAsset === "ETH" || normalizedAsset.includes("ETH")) {
    return (
      <Image
        src="/eth.png"
        alt="ETH"
        width={size}
        height={size}
        className={className}
      />
    );
  }

  // Fallback for other assets
  return (
    <span
      className={`flex items-center justify-center font-bold ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      ⚡
    </span>
  );
}

export default AssetIcon;
