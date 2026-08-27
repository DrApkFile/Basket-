/**
 * GET /api/basket/get
 *
 * Fetch a single basket's data by ID.
 * Public endpoint for shared basket view.
 */

import { NextRequest, NextResponse } from "next/server";
import { getBasket } from "@/lib/firestore-server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const basketId = searchParams.get("basketId");

  if (!basketId) {
    return NextResponse.json({ error: "basketId required" }, { status: 400 });
  }

  const basket = await getBasket(basketId);
  if (!basket) {
    return NextResponse.json({ error: "Basket not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: basket.id,
    asset: basket.asset,
    totalSpent: basket.totalSpent,
    maxSpend: basket.maxSpend,
    aiReasoning: basket.aiReasoning,
    status: basket.status,
    narration: basket.narration,
    createdAt: basket.createdAt?.toDate?.()?.toISOString() ?? null,
  });
}
