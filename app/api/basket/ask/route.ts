/**
 * POST /api/basket/ask
 *
 * Q&A about a basket's reasoning. Strictly grounded in stored proposal data.
 *
 * CONSTRAINTS (enforced in system prompt):
 * - May only explain/clarify stored reasoning and data
 * - Must NOT generate new predictions or confidence claims
 * - Must NOT give advice about whether to copy/trade
 * - Short responses (few sentences, not essays)
 *
 * Rate limited: 5 questions per basket per session
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getBasket } from "@/lib/firestore-server";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LegDoc } from "@/lib/firestore-types";

// Simple in-memory rate limiting (per IP + basketId)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

interface AskRequest {
  basketId: string;
  question: string;
}

export async function POST(request: NextRequest) {
  try {
    const { basketId, question } = (await request.json()) as AskRequest;

    if (!basketId) {
      return NextResponse.json({ error: "basketId required" }, { status: 400 });
    }
    if (!question || question.trim().length === 0) {
      return NextResponse.json({ error: "question required" }, { status: 400 });
    }
    if (question.length > 500) {
      return NextResponse.json({ error: "Question too long (max 500 chars)" }, { status: 400 });
    }

    // Rate limiting
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitKey = `${ip}:${basketId}`;
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429 }
      );
    }

    // Load basket
    const basket = await getBasket(basketId);
    if (!basket) {
      return NextResponse.json({ error: "Basket not found" }, { status: 404 });
    }

    // Load legs for context
    const legsSnap = await getDocs(collection(db, "baskets", basketId, "legs"));
    const legs: LegDoc[] = legsSnap.docs.map((d) => d.data() as LegDoc);

    // Build context from stored data ONLY
    const legSummaries = legs.map((l) => ({
      symbol: l.symbol,
      side: l.side,
      quantity: l.quantity,
      price: l.price,
      cost: l.cost,
      interval: l.interval,
    }));

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const systemPrompt = `You are a clarification assistant for a prediction market basket. You may ONLY explain, clarify, or elaborate on the reasoning and data that was stored when this basket was created.

STRICT RULES:
1. You must NOT generate new predictions, forecasts, or confidence claims
2. You must NOT give advice about whether to copy, trade, or invest
3. You must NOT speculate about current market conditions (you only know what was stored)
4. If asked something outside this scope (e.g., "will BTC actually go up?", "should I copy this?"), say plainly: "I can only explain the original reasoning stored with this basket. I cannot make new predictions or give trading advice."
5. Keep responses SHORT — 2-4 sentences maximum. This is a clarification tool, not a chatbot.

BASKET CONTEXT (stored at creation time):
Asset: ${basket.asset}
Total Spent: $${basket.totalSpent.toFixed(2)}
Max Spend: $${basket.maxSpend.toFixed(2)}

AI Reasoning (stored):
${basket.aiReasoning}

Positions (at time of creation):
${legSummaries.map((l) => `- ${l.symbol} ${l.side}: ${l.quantity} contracts @ ${(l.price * 100).toFixed(1)}% ($${l.cost.toFixed(2)})`).join("\n")}

Answer the user's question based ONLY on this stored context.`;

    const prompt = `${systemPrompt}

USER QUESTION: ${question}`;

    const result = await model.generateContent(prompt);

    const answer = result.response.text().trim();

    return NextResponse.json({
      answer,
      basketId,
      questionsRemaining: Math.max(0, RATE_LIMIT - (rateLimitMap.get(rateLimitKey)?.count ?? 0)),
    });
  } catch (err) {
    console.error("Basket ask error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
