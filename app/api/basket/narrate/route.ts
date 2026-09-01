/**
 * POST /api/basket/narrate
 *
 * AI monitor that produces plain-language status updates for a basket.
 * Server reads current on-chain leg statuses, calculates win/loss/payout,
 * then calls Gemini to narrate honestly (losses included).
 *
 * SECURITY: On-chain status is source of truth. Firestore is only a cache
 * updated AFTER on-chain verification via getMarketOnchain().
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getBasket, getBasketLegsWithStatus, updateBasketStatus, markLegRedeemed } from "@/lib/firestore-server";
import { ONCHAIN_STATUS_LABELS, type LegDoc } from "@/lib/firestore-types";
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";

const INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";

interface LegWithOutcome extends LegDoc {
  resolvedOutcome: "won" | "lost" | "voided" | "pending";
  payout: number;
}

/**
 * Determine if a leg won/lost based on on-chain resolution data.
 * MarketStatus enum: 0=Listed, 1=Trading, 2=Locked, 3=Settling, 4=Resolved, 5=Voided
 */
async function checkLegOutcome(
  exchange: SomniaMarkets,
  leg: LegDoc
): Promise<{ outcome: "won" | "lost" | "voided" | "pending"; payout: number }> {
  try {
    const onchain = await exchange.client.getMarketOnchain(leg.marketId as `0x${string}`);

    if (onchain.status === 5) {
      // Voided — both sides redeem at 0.5
      return { outcome: "voided", payout: leg.filled * 0.5 };
    }

    if (onchain.status === 4) {
      // Resolved — check winning outcome
      // winningOutcome: 0 = DOWN/NO, 1 = UP/YES
      const winningOutcome = onchain.winningOutcome;
      const legIsYes = leg.side === "YES";
      const won = (winningOutcome === 1 && legIsYes) || (winningOutcome === 0 && !legIsYes);

      if (won) {
        // Winner gets $1 per contract
        return { outcome: "won", payout: leg.filled };
      } else {
        // Loser gets $0
        return { outcome: "lost", payout: 0 };
      }
    }

    // Not yet resolved (Listed=0, Trading=1, Locked=2, Settling=3)
    return { outcome: "pending", payout: 0 };
  } catch {
    // Market might be finalized/removed from registry
    return { outcome: "pending", payout: 0 };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { basketId } = (await request.json()) as { basketId: string };

    if (!basketId) {
      return NextResponse.json({ error: "basketId required" }, { status: 400 });
    }

    // Get basket
    const basket = await getBasket(basketId);
    if (!basket) {
      return NextResponse.json({ error: "Basket not found" }, { status: 404 });
    }

    // Get legs with refreshed on-chain status
    const legs = await getBasketLegsWithStatus(basketId);
    if (legs.length === 0) {
      return NextResponse.json({ error: "No legs found" }, { status: 404 });
    }

    // Create exchange for on-chain checks
    const exchange = new SomniaMarkets({
      indexerUrl: INDEXER_URL,
      chain: somniaShannon,
      addresses: SOMNIA_TESTNET_ADDRESSES,
    });

    // Check each leg's outcome
    const legsWithOutcomes: LegWithOutcome[] = [];
    for (const leg of legs) {
      const { outcome, payout } = await checkLegOutcome(exchange, leg);
      legsWithOutcomes.push({
        ...leg,
        resolvedOutcome: outcome,
        payout,
      });
    }

    // Calculate summary stats
    // MarketStatus enum: 0=Listed, 1=Trading, 2=Locked, 3=Settling, 4=Resolved, 5=Voided
    const tradingCount = legsWithOutcomes.filter((l) => l.onchainStatus === 1).length;
    const lockedCount = legsWithOutcomes.filter((l) => l.onchainStatus === 2 || l.onchainStatus === 3).length;
    const resolvedCount = legsWithOutcomes.filter((l) => l.onchainStatus === 4).length;
    const voidedCount = legsWithOutcomes.filter((l) => l.onchainStatus === 5).length;
    const settledCount = resolvedCount + voidedCount;

    const wins = legsWithOutcomes.filter((l) => l.resolvedOutcome === "won").length;
    const losses = legsWithOutcomes.filter((l) => l.resolvedOutcome === "lost").length;
    const voided = legsWithOutcomes.filter((l) => l.resolvedOutcome === "voided").length;
    const pending = legsWithOutcomes.filter((l) => l.resolvedOutcome === "pending").length;

    const totalCost = legsWithOutcomes.reduce((sum, l) => sum + l.cost, 0);
    const totalPayout = legsWithOutcomes.reduce((sum, l) => sum + l.payout, 0);
    const netPnL = totalPayout - totalCost;

    // Find next expiry for pending legs
    const pendingLegs = legsWithOutcomes.filter((l) => l.resolvedOutcome === "pending");
    const nextExpiry = pendingLegs.length > 0
      ? Math.min(...pendingLegs.map((l) => l.expiry))
      : null;
    const minutesToNextExpiry = nextExpiry
      ? Math.max(0, Math.round((nextExpiry - Date.now() / 1000) / 60))
      : null;

    // Build leg summaries for Gemini
    const legSummaries = legsWithOutcomes.map((leg) => ({
      symbol: leg.symbol,
      side: leg.side,
      quantity: leg.quantity,
      filled: leg.filled,
      cost: leg.cost,
      status: ONCHAIN_STATUS_LABELS[leg.onchainStatus] ?? `Unknown(${leg.onchainStatus})`,
      outcome: leg.resolvedOutcome,
      payout: leg.payout,
      expiresIn: leg.expiry > Date.now() / 1000
        ? `${Math.round((leg.expiry - Date.now() / 1000) / 60)}m`
        : "expired",
    }));

    // Call Gemini for narration
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

    const prompt = `You are narrating the status of a prediction market basket to a user.
Keep it SHORT (2-3 sentences max), honest, and informative.
IMPORTANT: Report losses plainly — do NOT sugarcoat or hide bad news.

BASKET STATUS:
- Asset: ${basket.asset}
- Total legs: ${legs.length}
- Trading: ${tradingCount}
- Locked (awaiting settlement): ${lockedCount}
- Resolved: ${resolvedCount}
- Voided: ${voidedCount}

OUTCOMES:
- Wins: ${wins}
- Losses: ${losses}
- Voided: ${voided}
- Pending: ${pending}

FINANCIALS:
- Total cost: $${totalCost.toFixed(2)}
- Total payout so far: $${totalPayout.toFixed(2)}
- Net P&L: ${netPnL >= 0 ? "+" : ""}$${netPnL.toFixed(2)}
${minutesToNextExpiry !== null ? `- Next pending leg expires in: ${minutesToNextExpiry} minutes` : ""}

INDIVIDUAL LEGS:
${legSummaries.map((l) => `- ${l.symbol} ${l.side}: ${l.outcome.toUpperCase()}, filled ${l.filled}, payout $${l.payout.toFixed(2)}`).join("\n")}

${
  settledCount === legs.length
    ? "All legs have settled! Tell the user they can redeem their winnings now."
    : pending > 0
      ? `${pending} leg(s) still pending.`
      : ""
}

Write a brief, natural, HONEST status update. Include specific numbers.`;

    const result = await model.generateContent(prompt);
    const narration = result.response.text().trim();

    // Determine new basket status
    let newStatus = basket.status;
    if (settledCount === legs.length && basket.status !== "redeemed") {
      newStatus = "settled";
    }

    // Update basket with new narration
    await updateBasketStatus(basketId, newStatus, narration);

    return NextResponse.json({
      basketId,
      narration,
      status: newStatus,
      summary: {
        total: legs.length,
        trading: tradingCount,
        locked: lockedCount,
        resolved: resolvedCount,
        voided: voidedCount,
        settled: settledCount,
        wins,
        losses,
        pending,
        totalCost,
        totalPayout,
        netPnL,
        minutesToNextExpiry,
      },
      legs: legsWithOutcomes.map((l) => ({
        marketId: l.marketId,
        symbol: l.symbol,
        side: l.side,
        price: l.price, // Original price at time of order (for display)
        filled: l.filled,
        cost: l.cost,
        interval: l.interval,
        expiry: l.expiry,
        onchainStatus: l.onchainStatus,
        outcome: l.resolvedOutcome,
        payout: l.payout,
        redeemable: (l.resolvedOutcome === "won" || l.resolvedOutcome === "voided") && !l.redeemTxHash,
      })),
    });
  } catch (err) {
    console.error("Basket narrate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
