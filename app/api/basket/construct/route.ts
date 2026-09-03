/**
 * POST /api/basket/construct
 *
 * AI-powered basket constructor. Server-side only.
 *
 * SECURITY/CORRECTNESS DECISIONS (from SPEC.md):
 * 1. Server fetches live markets from chain FIRST — AI never sees unverified data
 * 2. Gemini uses structured/JSON output mode — no free-text parsing
 * 3. Hard constraints enforced IN CODE after Gemini responds:
 *    - Cannot exceed user's stated max spend
 *    - Cannot exceed max basket size (5 legs)
 *    - All selected markets must be Trading status
 * 4. Returns proposal for user review — approve/reject as a whole
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SomniaMarkets, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import type { BinaryMarket } from "@somnia-chain/markets-sdk";
import type { BasketConstructInput, BasketProposal, ProposedLeg, LegSide, LiquidityLabel, AvailabilityNote } from "@/lib/firestore-types";
import { computeRiskComparison } from "@/lib/risk-comparison";
import { createHash } from "crypto";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";

const INDEXER_URL = "https://dev.smk.somnia.host/v1/graphql";
const MAX_BASKET_SIZE = 5; // Hard limit — enforced in code, not just prompted

// Compute SHA-256 hash of canonical JSON
function computeProposalHash(proposal: object): string {
  const canonical = JSON.stringify(proposal, Object.keys(proposal).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

function buildLiquidityNote(market: {
  liquidityLabel: LiquidityLabel;
  depthScore: number;
  tradeCount: number;
  lastTradeAt: number | null;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const lastTradeAgo = market.lastTradeAt
    ? Math.round((now - market.lastTradeAt) / 60)
    : null;

  if (market.liquidityLabel === "deep") {
    return `Deep liquidity: ${market.depthScore} depth, ${market.tradeCount} trades${
      lastTradeAgo !== null ? ` (last ${lastTradeAgo}m ago)` : ""
    }`;
  } else if (market.liquidityLabel === "thin") {
    return `Thin liquidity: ${market.depthScore} depth, ${market.tradeCount} trades — fill price may vary`;
  } else {
    return `Stale market: ${market.tradeCount} trades${
      lastTradeAgo !== null ? `, last ${lastTradeAgo}m ago` : ", no recent trades"
    } — fill price may differ`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BasketConstructInput & {
      maxExpiryMinutes?: number;
      intervalMinutes?: number; // Filter by market interval type (5, 15, 60, etc.)
    };
    const { asset, numWindows, maxSpend, riskTolerance, crossAsset, maxExpiryMinutes, intervalMinutes } = body;

    // Determine which assets to consider
    const isCrossAsset = crossAsset === true || asset === "BTC+ETH";
    const targetAssets = isCrossAsset ? ["BTC", "ETH"] : [asset];
    const assetLabel = isCrossAsset ? "BTC + ETH" : asset;

    // Validate input
    if (!asset && !isCrossAsset) {
      return NextResponse.json({ error: "Asset is required." }, { status: 400 });
    }
    if (!numWindows || numWindows < 2 || numWindows > MAX_BASKET_SIZE) {
      return NextResponse.json(
        { error: `numWindows must be between 2 and ${MAX_BASKET_SIZE}.` },
        { status: 400 }
      );
    }
    if (!maxSpend || maxSpend <= 0) {
      return NextResponse.json({ error: "maxSpend must be positive." }, { status: 400 });
    }

    // 1. FETCH LIVE MARKETS FROM CHAIN — AI never sees unverified data
    const exchange = new SomniaMarkets({
      indexerUrl: INDEXER_URL,
      chain: somniaShannon,
      addresses: SOMNIA_TESTNET_ADDRESSES,
    });

    await exchange.loadMarkets();
    const now = Math.floor(Date.now() / 1000);
    const MIN_TIME_BUFFER = 2 * 60; // At least 2 minutes before expiry

    // Calculate max expiry time based on user preference
    const maxExpirySeconds = maxExpiryMinutes ? maxExpiryMinutes * 60 : null;

    // Parse interval filter (e.g., 5 -> "5min", 15 -> "15min", 60 -> "1hr")
    const targetInterval = intervalMinutes
      ? intervalMinutes >= 60
        ? `${intervalMinutes / 60}hr`
        : `${intervalMinutes}min`
      : null;

    // Filter to: binary, active, matching asset prefix(es), within expiry constraints
    const liveMarkets = Object.values(exchange.markets).filter((m) => {
      if (m.type !== "binary" || !m.active) return false;
      // m.base is like "ETH-244039-25AUG26-2155", extract prefix
      const marketAsset = m.base.split("-")[0];
      if (!targetAssets.includes(marketAsset)) return false;

      const info = m.info as BinaryMarket;
      const expiry = Number(info.expiry);
      const timeToExpiry = expiry - now;

      // Must expire after minimum buffer
      if (timeToExpiry < MIN_TIME_BUFFER) return false;

      // If maxExpiryMinutes specified, must expire within that window
      if (maxExpirySeconds && timeToExpiry > maxExpirySeconds) return false;

      // If interval filter specified, must match the market's interval type
      if (targetInterval && info.interval !== targetInterval) return false;

      return true;
    });

    if (liveMarkets.length === 0) {
      // Check what assets ARE available (without time/interval constraint)
      const allLive = Object.values(exchange.markets).filter((m) => {
        if (m.type !== "binary" || !m.active) return false;
        const expiry = Number((m.info as BinaryMarket).expiry);
        return expiry > now + MIN_TIME_BUFFER;
      });
      const availableAssets = [...new Set(allLive.map((m) => m.base.split("-")[0]))];
      const availableIntervals = [...new Set(allLive.map((m) => (m.info as BinaryMarket).interval))];

      const timeConstraintMsg = maxExpiryMinutes
        ? ` expiring within ${maxExpiryMinutes} minutes`
        : "";
      const intervalConstraintMsg = targetInterval
        ? ` with ${targetInterval} interval`
        : "";

      let hint = "";
      if (targetInterval && !availableIntervals.includes(targetInterval)) {
        hint = `No ${targetInterval} markets available. Try: ${availableIntervals.join(", ")}`;
      } else if (maxExpiryMinutes || targetInterval) {
        hint = `Try removing filters. Available intervals: ${availableIntervals.join(", ")}`;
      } else if (availableAssets.length > 0) {
        hint = `Try one of: ${availableAssets.join(", ")}`;
      } else {
        hint = "No markets available at all right now.";
      }

      return NextResponse.json(
        {
          error: `No live ${assetLabel} markets${intervalConstraintMsg}${timeConstraintMsg} available right now.`,
          availableAssets,
          availableIntervals,
          hint,
        },
        { status: 404 }
      );
    }

    // Verify each market is actually Trading status on-chain + fetch liquidity data
    interface CandidateMarket {
      id: string;
      symbol: string;
      interval: string;
      expiry: number;
      bestAsk: number;
      bestBid: number;
      // Liquidity metrics
      depthScore: number; // sum of quantity within 2% of best price
      tradeCount: number;
      lastTradeAt: number | null;
      liquidityLabel: LiquidityLabel;
    }
    const tradingMarkets: CandidateMarket[] = [];

    for (const m of liveMarkets.slice(0, 20)) {
      // Limit to 20 to avoid too many RPC calls
      try {
        const onchain = await exchange.client.getMarketOnchain(m.id as `0x${string}`);
        if (onchain.status !== 1) continue; // Not Trading

        // Get order book with depth
        const book = await exchange.fetchOrderBook(`${m.symbol}#YES`, 10);
        const bestAsk = book.asks[0]?.[0] ?? 0.5;
        const bestBid = book.bids[0]?.[0] ?? 0.5;

        // Compute depth score: sum of quantity within 2% of best price on each side
        const DEPTH_THRESHOLD = 0.02;
        let askDepth = 0;
        let bidDepth = 0;
        for (const [price, qty] of book.asks) {
          if (price <= bestAsk * (1 + DEPTH_THRESHOLD)) {
            askDepth += qty;
          }
        }
        for (const [price, qty] of book.bids) {
          if (price >= bestBid * (1 - DEPTH_THRESHOLD)) {
            bidDepth += qty;
          }
        }
        const depthScore = Math.round(askDepth + bidDepth);

        // Extract trade data from market info
        const info = m.info as BinaryMarket;
        const tradeCount = Number(info.tradeCount ?? 0);
        const lastTradeAtRaw = info.lastTradeAt;
        const lastTradeAt = lastTradeAtRaw ? Number(lastTradeAtRaw) : null;

        // Compute liquidity label
        const expiryTime = Number(info.expiry);
        const timeToExpiry = expiryTime - now;
        let liquidityLabel: LiquidityLabel;

        // "stale" if last trade was more than 50% of time-to-expiry ago, or no trades at all
        if (lastTradeAt === null || tradeCount === 0) {
          liquidityLabel = "stale";
        } else if (now - lastTradeAt > timeToExpiry * 0.5) {
          liquidityLabel = "stale";
        } else if (depthScore < 50 || tradeCount < 5) {
          // "thin" if depth score is low or very few trades
          liquidityLabel = "thin";
        } else {
          liquidityLabel = "deep";
        }

        tradingMarkets.push({
          id: m.id,
          symbol: m.symbol,
          interval: info.interval ?? "?",
          expiry: expiryTime,
          bestAsk,
          bestBid,
          depthScore,
          tradeCount,
          lastTradeAt,
          liquidityLabel,
        });
      } catch {
        // Skip markets we can't verify
      }
    }

    // Check availability - be transparent, not blocking
    let availabilityNote: AvailabilityNote | undefined;
    const actualWindowsToSelect = Math.min(numWindows, tradingMarkets.length);

    if (tradingMarkets.length < 2) {
      // Can't make a meaningful basket with 0-1 markets
      return NextResponse.json(
        {
          error: `No basket possible for ${assetLabel} right now — only ${tradingMarkets.length} live window(s). Try ${isCrossAsset ? "checking back shortly" : "BTC + ETH together, or check back shortly"}.`,
          availableCount: tradingMarkets.length,
        },
        { status: 404 }
      );
    }

    if (tradingMarkets.length < numWindows) {
      // Fewer available than requested - proceed but be transparent
      const intervalTypes = [...new Set(tradingMarkets.map((m) => m.interval))];
      const intervalInfo = targetInterval
        ? `Only ${tradingMarkets.length} ${targetInterval} markets found.`
        : `Available intervals: ${intervalTypes.join(", ")}.`;
      availabilityNote = {
        requested: numWindows,
        available: tradingMarkets.length,
        message: `Only ${tradingMarkets.length} ${assetLabel} windows are live right now out of ${numWindows} requested. ${intervalInfo} The rest are either between windows or already settled.`,
      };
    }

    // 2. CALL GEMINI WITH STRUCTURED OUTPUT
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured." }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `You are constructing a prediction market basket for a user. Your selections must be grounded in actual market data.

USER REQUEST:
- Asset(s): ${assetLabel}${isCrossAsset ? " (cross-asset basket)" : ""}
- Number of windows to select: ${actualWindowsToSelect}${availabilityNote ? ` (${numWindows} requested, but only ${tradingMarkets.length} available)` : ""}
- Max total spend: ${maxSpend} USDC
- Risk tolerance: ${riskTolerance}

AVAILABLE MARKETS (verified Trading status, with liquidity data):
${tradingMarkets
  .sort((a, b) => a.expiry - b.expiry)
  .map(
    (m, i) =>
      `${i + 1}. ID: ${m.id}
   Symbol: ${m.symbol}
   Asset: ${m.symbol.split("-")[0]}
   Interval: ${m.interval}
   Expiry: ${new Date(m.expiry * 1000).toISOString()}
   Best Ask (YES): ${m.bestAsk.toFixed(4)} | Best Bid: ${m.bestBid.toFixed(4)}
   LIQUIDITY: ${m.liquidityLabel.toUpperCase()}
     - Depth score: ${m.depthScore} contracts within 2% of best price
     - Trade count: ${m.tradeCount}
     - Last trade: ${m.lastTradeAt ? new Date(m.lastTradeAt * 1000).toISOString() : "never"}`
  )
  .join("\n\n")}

RULES:
1. Select exactly ${actualWindowsToSelect} DIFFERENT markets (different expiry times)
2. For each market, choose YES or NO based on implied directional view
3. Assign weights (0-1) that sum to approximately 1.0
4. ${riskTolerance === "low" ? "Prefer shorter intervals and smaller position sizes" : riskTolerance === "high" ? "Can take larger concentrated positions" : "Balance risk across positions"}
5. IMPORTANT: Each market ID must be unique — no duplicates.
${isCrossAsset ? `6. This is a CROSS-ASSET basket (BTC + ETH together). You may select windows from both assets to spread exposure across different assets. When explaining this in reasoning, say "spreads exposure across two different assets (BTC and ETH)" — this is honest and defensible. Do NOT claim any specific correlation number or imply you computed cross-asset correlation — you haven't.` : ""}

LIQUIDITY RULES (MUST FOLLOW):
- STRONGLY PREFER "DEEP" liquidity markets when candidates are otherwise similar
- If you select a "THIN" or "STALE" market, you MUST explain why in reasoning
- When selecting thin/stale markets, note that fill price may differ from quote
- Do NOT use vague language like "diversify risk" — back every claim with actual numbers (depth score, trade count, price difference, time horizon)

Respond with JSON:
{
  "selectedMarkets": [
    {
      "marketId": "0x...",
      "side": "YES" or "NO",
      "weight": 0.5,
      "liquidityNote": "Deep liquidity: 142 depth, 28 trades in last hour"
    }
  ],
  "reasoning": "Data-backed explanation referencing actual numbers",
  "worstCaseExplanation": "what happens if all positions lose",
  "bestCaseExplanation": "what happens if all positions win"
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const aiResponse = JSON.parse(responseText) as {
      selectedMarkets: Array<{
        marketId: string;
        side: string;
        weight: number;
        liquidityNote: string;
      }>;
      reasoning: string;
      worstCaseExplanation: string;
      bestCaseExplanation: string;
    };

    // 3. ENFORCE HARD CONSTRAINTS IN CODE — not just prompted
    // Constraint A: Limit to max basket size
    if (aiResponse.selectedMarkets.length > MAX_BASKET_SIZE) {
      aiResponse.selectedMarkets = aiResponse.selectedMarkets.slice(0, MAX_BASKET_SIZE);
    }

    // Constraint B: Ensure all selected markets are in our verified list
    const validSelections = aiResponse.selectedMarkets.filter((sel) =>
      tradingMarkets.some((m) => m.id === sel.marketId)
    );

    if (validSelections.length === 0) {
      return NextResponse.json(
        { error: "AI selected no valid markets. Please try again." },
        { status: 500 }
      );
    }

    // Constraint C: Normalize weights and calculate costs
    const totalWeight = validSelections.reduce((sum, s) => sum + s.weight, 0);
    const legs: ProposedLeg[] = [];
    let totalCost = 0;

    for (const sel of validSelections) {
      const market = tradingMarkets.find((m) => m.id === sel.marketId)!;
      const normalizedWeight = sel.weight / totalWeight;
      const allocation = maxSpend * normalizedWeight;
      const price = sel.side === "YES" ? market.bestAsk : 1 - market.bestAsk;
      const quantity = Math.floor(allocation / price); // Floor to ensure we don't exceed

      if (quantity < 1) continue; // Skip if allocation too small

      const cost = quantity * price;
      totalCost += cost;

      // Build data-backed liquidity note if AI didn't provide one
      const aiLiquidityNote = sel.liquidityNote;
      const fallbackNote = buildLiquidityNote(market);

      legs.push({
        marketId: market.id,
        symbol: market.symbol,
        side: sel.side as LegSide,
        quantity,
        price,
        interval: market.interval,
        expiry: market.expiry,
        cost,
        liquidityNote: aiLiquidityNote || fallbackNote,
        liquidityLabel: market.liquidityLabel,
      });
    }

    // Constraint D: HARD CHECK — total cost must not exceed max spend
    // This is the exact check from SPEC.md — enforced in code, not trusted to AI
    if (totalCost > maxSpend) {
      // Scale down all quantities proportionally
      const scaleFactor = maxSpend / totalCost;
      totalCost = 0;
      for (const leg of legs) {
        leg.quantity = Math.floor(leg.quantity * scaleFactor);
        leg.cost = leg.quantity * leg.price;
        totalCost += leg.cost;
      }
    }

    // Remove legs with 0 quantity after scaling
    const finalLegs = legs.filter((l) => l.quantity > 0);

    if (finalLegs.length === 0) {
      return NextResponse.json(
        { error: "Max spend too low for any meaningful positions." },
        { status: 400 }
      );
    }

    // Calculate worst/best case payouts
    // Worst case: all positions lose → payout = 0
    // Best case: all positions win → payout = total quantity (1 USDC per contract)
    const totalQuantity = finalLegs.reduce((sum, l) => sum + l.quantity, 0);
    const worstCase = 0;
    const bestCase = totalQuantity;

    // Compute risk comparison (deterministic, not from AI)
    const riskData = computeRiskComparison(
      finalLegs.map((l) => ({ price: l.price, cost: l.cost })),
      totalCost
    );

    const riskComparison = {
      basketStdDev: riskData.basketStdDev,
      singleBetStdDev: riskData.singleBetStdDev,
      varianceReductionPct: riskData.varianceReductionPct,
    };

    // Build proposal without hash first (for hashing)
    const proposalData = {
      asset: assetLabel,
      legs: finalLegs,
      totalCost,
      worstCase,
      bestCase,
      reasoning: `${aiResponse.reasoning}\n\nWorst case: ${aiResponse.worstCaseExplanation}\n\nBest case: ${aiResponse.bestCaseExplanation}`,
      riskComparison,
      ...(availabilityNote && { availabilityNote }),
    };

    // Compute tamper-evident hash
    const proposalTimestamp = new Date().toISOString();
    const proposalHash = computeProposalHash({ ...proposalData, proposalTimestamp });

    // Store hash in Firestore (before returning to client)
    try {
      await addDoc(collection(db, "proposal_hashes"), {
        hash: proposalHash,
        timestamp: proposalTimestamp,
        asset: assetLabel,
        totalCost,
        legCount: finalLegs.length,
        crossAsset: isCrossAsset,
        createdAt: new Date(),
      });
    } catch (firestoreErr) {
      console.warn("Failed to store proposal hash:", firestoreErr);
      // Continue anyway — hash storage failure shouldn't block the proposal
    }

    const proposal: BasketProposal = {
      ...proposalData,
      proposalHash,
      proposalTimestamp,
    };

    return NextResponse.json(proposal);
  } catch (err) {
    console.error("Basket construct error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
