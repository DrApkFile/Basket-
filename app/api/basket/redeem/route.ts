/**
 * POST /api/basket/redeem
 *
 * Redeem all winning/voided legs in a basket at once.
 * Uses the explicit-outcome-index pattern per SDK knowledge.
 *
 * SECURITY: Server verifies each market is actually resolved/voided on-chain
 * before attempting redemption. Client provides signed wallet for tx execution.
 */

import { NextRequest, NextResponse } from "next/server";
import { getBasket, getBasketLegsWithStatus, markLegRedeemed, updateBasketStatus } from "@/lib/firestore-server";
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

const INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";

export async function POST(request: NextRequest) {
  try {
    const { basketId, walletAddress } = (await request.json()) as {
      basketId: string;
      walletAddress: string;
    };

    if (!basketId || !walletAddress) {
      return NextResponse.json(
        { error: "basketId and walletAddress required" },
        { status: 400 }
      );
    }

    // Get basket and verify ownership
    const basket = await getBasket(basketId);
    if (!basket) {
      return NextResponse.json({ error: "Basket not found" }, { status: 404 });
    }
    if (basket.userId.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json({ error: "Not your basket" }, { status: 403 });
    }

    // Get all legs with current on-chain status
    const legs = await getBasketLegsWithStatus(basketId);

    // Create exchange for on-chain verification
    const exchange = new SomniaMarkets({
      indexerUrl: INDEXER_URL,
      chain: somniaShannon,
      addresses: SOMNIA_TESTNET_ADDRESSES,
    });

    // Find legs that are redeemable (resolved/voided and not already redeemed)
    const redeemableLegs: Array<{
      marketId: string;
      symbol: string;
      side: string;
      filled: number;
      onchainStatus: number;
      outcomeIndex: number; // 0 = NO/DOWN, 1 = YES/UP
      estimatedPayout: number;
    }> = [];

    for (const leg of legs) {
      if (leg.redeemTxHash) continue; // Already redeemed

      try {
        const onchain = await exchange.client.getMarketOnchain(leg.marketId as `0x${string}`);

        // MarketStatus enum: 0=Listed, 1=Trading, 2=Locked, 3=Settling, 4=Resolved, 5=Voided
        if (onchain.status === 4) {
          // Resolved — check if this leg won
          const winningOutcome = onchain.winningOutcome; // 0 = NO/DOWN, 1 = YES/UP
          const legOutcomeIndex = leg.side === "YES" ? 1 : 0;

          if (winningOutcome === legOutcomeIndex) {
            // This leg won
            redeemableLegs.push({
              marketId: leg.marketId,
              symbol: leg.symbol,
              side: leg.side,
              filled: leg.filled,
              onchainStatus: 4,
              outcomeIndex: legOutcomeIndex,
              estimatedPayout: leg.filled, // $1 per contract
            });
          }
        } else if (onchain.status === 5) {
          // Voided — both sides can redeem at 0.5
          const legOutcomeIndex = leg.side === "YES" ? 1 : 0;
          redeemableLegs.push({
            marketId: leg.marketId,
            symbol: leg.symbol,
            side: leg.side,
            filled: leg.filled,
            onchainStatus: 5,
            outcomeIndex: legOutcomeIndex,
            estimatedPayout: leg.filled * 0.5,
          });
        }
      } catch (err) {
        console.warn(`Failed to check market ${leg.marketId}:`, err);
      }
    }

    if (redeemableLegs.length === 0) {
      return NextResponse.json({
        message: "No legs to redeem",
        redeemed: 0,
        totalPayout: 0,
      });
    }

    // Return the list of redeemable legs for the client to execute
    // The actual redemption tx must be signed by the user's wallet
    // Client will call exchange.trader.redeemPosition() for each
    const totalEstimatedPayout = redeemableLegs.reduce(
      (sum, l) => sum + l.estimatedPayout,
      0
    );

    return NextResponse.json({
      basketId,
      redeemableLegs,
      totalEstimatedPayout,
      instructions: "Client must execute redemption txs with user wallet signature",
    });
  } catch (err) {
    console.error("Basket redeem error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/basket/redeem
 * Mark legs as redeemed after client executes the txs.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { basketId, redemptions } = (await request.json()) as {
      basketId: string;
      redemptions: Array<{
        marketId: string;
        txHash: string;
        outcome: "won" | "voided";
      }>;
    };

    if (!basketId || !redemptions?.length) {
      return NextResponse.json(
        { error: "basketId and redemptions required" },
        { status: 400 }
      );
    }

    // Mark each leg as redeemed
    for (const r of redemptions) {
      await markLegRedeemed(basketId, r.marketId, r.txHash, r.outcome);
    }

    // Check if all legs are now redeemed
    const legs = await getBasketLegsWithStatus(basketId);
    const allRedeemed = legs.every(
      (l) => l.redeemTxHash || l.outcome === "lost"
    );

    if (allRedeemed) {
      await updateBasketStatus(basketId, "redeemed");
    }

    return NextResponse.json({
      basketId,
      redemptionsRecorded: redemptions.length,
      status: allRedeemed ? "redeemed" : "settled",
    });
  } catch (err) {
    console.error("Basket redeem patch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
