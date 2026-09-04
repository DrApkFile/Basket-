/**
 * Batch order placement for baskets.
 *
 * IMPORTANT (from SPEC.md): Each window has its own independent expiry.
 * We're NOT making this atomic on-chain — that's out of scope.
 * Instead, we place multiple separate orders and track them as a logical
 * "basket" in Firestore. Each order is independent.
 *
 * This function is called client-side (needs wallet signature for each order).
 */

import type { SomniaMarkets, Market } from "@somnia-chain/markets-sdk";
import type { ProposedLeg, LiquidityLabel } from "./firestore-types";
import { MIN_TRADEABLE_BUFFER_SECONDS } from "./market-constants";

export interface OrderResult {
  marketId: string;
  symbol: string;
  orderId: string;
  txHash: string;
  filled: number;
  success: boolean;
  error?: string;
}

export interface BatchOrderResult {
  results: OrderResult[];
  allSucceeded: boolean;
  successCount: number;
  failCount: number;
  /** The actual legs used (after refresh/substitution) - use these for saving */
  actualLegs: ProposedLeg[];
}

export interface Substitution {
  originalSymbol: string;
  newSymbol: string;
  reason: string;
}

export interface RefreshResult {
  legs: ProposedLeg[];
  substitutions: Substitution[];
  droppedCount: number;
}

/**
 * Refresh stale legs by finding replacement markets for any that have expired.
 * Call this before placing orders to handle market rollover.
 */
export async function refreshStaleLegs(
  exchange: SomniaMarkets,
  legs: ProposedLeg[]
): Promise<RefreshResult> {
  await exchange.loadMarkets();

  const now = Math.floor(Date.now() / 1000);
  const refreshedLegs: ProposedLeg[] = [];
  const substitutions: Substitution[] = [];
  let droppedCount = 0;

  // Get all currently trading binary markets
  const tradingMarkets = Object.values(exchange.markets).filter(
    (m) => m.type === "binary" && m.active
  );

  for (const leg of legs) {
    // Check if original market still exists and is available
    const originalMarket = tradingMarkets.find((m) => m.symbol === leg.symbol);

    if (originalMarket) {
      // Market still available - refresh price to ensure fill
      try {
        // Fetch the order book for the CORRECT side
        const side = leg.side;
        const book = await exchange.fetchOrderBook(`${originalMarket.symbol}#${side}`, 5);
        const bestAsk = book.asks[0]?.[0];

        // Validate bestAsk is a valid number
        if (typeof bestAsk !== "number" || isNaN(bestAsk) || bestAsk <= 0 || bestAsk >= 1) {
          // No valid ask - skip this leg, market has no liquidity
          console.log(`[refresh] No liquidity for ${leg.symbol}#${side}, skipping`);
          droppedCount++;
          continue;
        }

        // Take the ask price directly + small buffer for slippage
        // On thin markets, trying to get a better price just means no fill
        const fillPrice = Math.min(bestAsk + 0.02, 0.98);

        refreshedLegs.push({
          ...leg,
          price: fillPrice,
          cost: leg.quantity * fillPrice,
        });
      } catch {
        // Order book fetch failed - can't determine liquidity, skip
        console.log(`[refresh] Failed to fetch order book for ${leg.symbol}, skipping`);
        droppedCount++;
      }
      continue;
    }

    // Market not found - find a replacement with same asset
    const asset = leg.symbol.split("-")[0]; // ETH or BTC

    // Find markets for same asset, sorted by expiry (soonest first)
    const candidates = tradingMarkets
      .filter((m) => {
        const marketAsset = m.symbol.split("-")[0];
        return marketAsset === asset;
      })
      .map((m) => {
        const info = m.info as { expiry?: string | number };
        const expiry = Number(info.expiry || 0);
        return { market: m, expiry };
      })
      .filter((c) => c.expiry > now + MIN_TRADEABLE_BUFFER_SECONDS)
      .sort((a, b) => a.expiry - b.expiry);

    if (candidates.length === 0) {
      // No replacement available for this asset
      droppedCount++;
      console.log(`[refresh] No replacement found for ${leg.symbol}, dropping`);
      continue;
    }

    // Pick the first available candidate (soonest expiry)
    const replacement = candidates[0];
    const newMarket = replacement.market;

    // Fetch current price for the replacement market (correct side)
    let newPrice: number | null = null;
    try {
      const book = await exchange.fetchOrderBook(`${newMarket.symbol}#${leg.side}`, 5);
      const bestAsk = book.asks[0]?.[0];
      if (typeof bestAsk === "number" && !isNaN(bestAsk) && bestAsk > 0 && bestAsk < 1) {
        // Take the ask + small buffer
        newPrice = Math.min(bestAsk + 0.02, 0.98);
      }
    } catch {
      console.warn(`[refresh] Could not fetch price for ${newMarket.symbol}`);
    }

    // If no valid price, skip this replacement
    if (newPrice === null) {
      console.log(`[refresh] No liquidity for replacement ${newMarket.symbol}, skipping`);
      droppedCount++;
      continue;
    }

    const info = newMarket.info as { interval?: string; expiry?: string | number };

    // Create refreshed leg with new market
    const refreshedLeg: ProposedLeg = {
      marketId: newMarket.id,
      symbol: newMarket.symbol,
      side: leg.side,
      quantity: leg.quantity,
      price: newPrice,
      interval: info.interval ?? leg.interval,
      expiry: Number(info.expiry || leg.expiry),
      cost: leg.quantity * newPrice,
      liquidityNote: `Substituted: original market expired`,
      liquidityLabel: "thin" as LiquidityLabel,
    };

    refreshedLegs.push(refreshedLeg);
    substitutions.push({
      originalSymbol: leg.symbol,
      newSymbol: newMarket.symbol,
      reason: "Original market expired, substituted with next available window",
    });

    console.log(`[refresh] Substituted ${leg.symbol} → ${newMarket.symbol}`);
  }

  return {
    legs: refreshedLegs,
    substitutions,
    droppedCount,
  };
}

/**
 * Place multiple orders for a basket.
 * Each order is placed sequentially (not atomic) because:
 * 1. Each market is independent with its own expiry
 * 2. User needs to sign each transaction
 * 3. SPEC explicitly says "not one atomic on-chain transaction"
 *
 * @param exchange - SomniaMarkets instance with signer bound
 * @param legs - Array of proposed legs from AI constructor
 * @param onProgress - Optional callback for progress updates
 */
export async function placeBatchOrders(
  exchange: SomniaMarkets,
  legs: ProposedLeg[],
  onProgress?: (completed: number, total: number, current: string) => void
): Promise<BatchOrderResult & { substitutions?: Substitution[] }> {
  const results: OrderResult[] = [];
  let successCount = 0;

  // Refresh stale legs first - finds replacements for expired markets
  onProgress?.(0, legs.length, "Checking market availability...");
  const refreshResult = await refreshStaleLegs(exchange, legs);
  const freshLegs = refreshResult.legs;

  if (freshLegs.length === 0) {
    return {
      results: [],
      allSucceeded: false,
      successCount: 0,
      failCount: legs.length,
      substitutions: refreshResult.substitutions,
      actualLegs: [],
    };
  }

  // Log substitutions for debugging
  if (refreshResult.substitutions.length > 0) {
    console.log(`[batch-orders] Made ${refreshResult.substitutions.length} substitutions:`,
      refreshResult.substitutions.map(s => `${s.originalSymbol} → ${s.newSymbol}`));
  }

  for (let i = 0; i < freshLegs.length; i++) {
    const leg = freshLegs[i];
    onProgress?.(i, freshLegs.length, leg.symbol);

    try {
      // Construct the full symbol with outcome side
      const symbol = `${leg.symbol}#${leg.side}`;

      // Place order using the unified exchange API
      // createOrder handles tick-quantization internally
      const result = await exchange.createOrder(
        symbol,
        "limit",
        "buy", // Always buying outcome tokens
        leg.quantity,
        leg.price
      );

      results.push({
        marketId: leg.marketId,
        symbol: leg.symbol,
        orderId: String(result.id),
        txHash: result.txHash ?? "",
        filled: Number(result.filled), // Ensure number, not BigInt
        success: true,
      });
      successCount++;
    } catch (err) {
      // Log the full error for debugging
      console.error(`Order failed for ${leg.symbol}:`, err);

      // Extract meaningful error message
      let errorMsg = "Unknown error";
      if (err instanceof Error) {
        errorMsg = err.message;
        // Check for common SDK errors
        if (errorMsg.includes("SignerRequired")) {
          errorMsg = "Wallet not connected or signer not set";
        } else if (errorMsg.includes("InsufficientBalance")) {
          errorMsg = "Insufficient tUSDC balance";
        } else if (errorMsg.includes("WebSocket")) {
          errorMsg = "RPC connection failed (testnet may be unstable)";
        } else if (errorMsg.includes("unknown symbol")) {
          // Symbol not found - could be stale proposal or SDK issue
          errorMsg = `Market not found: ${leg.symbol}. Try creating a new basket.`;
        }
      }

      results.push({
        marketId: leg.marketId,
        symbol: leg.symbol,
        orderId: "",
        txHash: "",
        filled: 0,
        success: false,
        error: errorMsg,
      });
    }
  }

  onProgress?.(freshLegs.length, freshLegs.length, "Done");

  return {
    results,
    allSucceeded: successCount === freshLegs.length,
    successCount,
    failCount: freshLegs.length - successCount,
    substitutions: refreshResult.substitutions,
    actualLegs: freshLegs,
  };
}

/**
 * Verify all markets in a proposal are still Trading status before placing orders.
 * This is called client-side before batch placement.
 */
export async function verifyMarketsTrading(
  exchange: SomniaMarkets,
  legs: ProposedLeg[]
): Promise<{ allTrading: boolean; failedMarkets: string[] }> {
  const failedMarkets: string[] = [];

  for (const leg of legs) {
    try {
      const onchain = await exchange.client.getMarketOnchain(leg.marketId as `0x${string}`);
      if (onchain.status !== 1) {
        // 1 = Trading
        failedMarkets.push(`${leg.symbol} is ${onchain.status === 2 ? "Locked" : "not Trading"}`);
      }
    } catch (err) {
      failedMarkets.push(`${leg.symbol}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return {
    allTrading: failedMarkets.length === 0,
    failedMarkets,
  };
}
