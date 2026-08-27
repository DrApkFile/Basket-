import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Strict Mode to prevent double-invoking effects/renders in dev
  reactStrictMode: false,
  // The 13-40s "Finished writing to filesystem cache" stalls in dev are the
  // real bottleneck on this disk (flagged separately by Next's own "slow
  // filesystem" warning) — keeping Turbopack's cache in memory instead of
  // round-tripping through disk on every compile removes that stall. Costs
  // losing the warm-cache benefit across dev-server restarts, which doesn't
  // matter for a single working session.
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
