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

import type { SomniaMarkets } from "@somnia-chain/markets-sdk";
import type { ProposedLeg } from "./firestore-types";

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
): Promise<BatchOrderResult> {
  const results: OrderResult[] = [];
  let successCount = 0;

  // Load markets first - SDK requires this to resolve symbols
  onProgress?.(0, legs.length, "Loading markets...");
  await exchange.loadMarkets();

  // Debug: log loaded market count
  const marketCount = Object.keys(exchange.markets).length;
  console.log(`[batch-orders] Loaded ${marketCount} markets`);

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    onProgress?.(i, legs.length, leg.symbol);

    // Debug: check if this specific market exists in loaded markets
    const marketExists = Object.values(exchange.markets).some(m => m.symbol === leg.symbol);
    console.log(`[batch-orders] Market ${leg.symbol} exists: ${marketExists}`);
    if (!marketExists) {
      // Log available symbols for debugging
      const availableSymbols = Object.values(exchange.markets).map(m => m.symbol).slice(0, 5);
      console.log(`[batch-orders] Sample available symbols:`, availableSymbols);
    }

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
        orderId: result.id,
        txHash: result.txHash ?? "",
        filled: result.filled,
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

  onProgress?.(legs.length, legs.length, "Done");

  return {
    results,
    allSucceeded: successCount === legs.length,
    successCount,
    failCount: legs.length - successCount,
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
