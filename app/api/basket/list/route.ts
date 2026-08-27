/**
 * GET /api/basket/list?userId=0x...
 *
 * List all baskets for a user with their current status.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserBaskets, getBasketLegsWithStatus } from "@/lib/firestore-server";

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const baskets = await getUserBaskets(userId);

    // Enhance each basket with leg summary
    const basketsWithLegs = await Promise.all(
      baskets.map(async (basket) => {
        const legs = await getBasketLegsWithStatus(basket.id);
        const pendingCount = legs.filter((l) => l.onchainStatus < 4).length;
        const settledCount = legs.filter((l) => l.onchainStatus >= 4).length;
        const redeemableCount = legs.filter(
          (l) => (l.onchainStatus === 4 || l.onchainStatus === 5) && !l.redeemTxHash
        ).length;

        return {
          ...basket,
          legCount: legs.length,
          pendingCount,
          settledCount,
          redeemableCount,
          createdAt: basket.createdAt?.toDate?.()?.toISOString() ?? null,
          updatedAt: basket.updatedAt?.toDate?.()?.toISOString() ?? null,
        };
      })
    );

    return NextResponse.json({
      userId,
      baskets: basketsWithLegs,
      total: basketsWithLegs.length,
      totalPending: basketsWithLegs.filter((b) => b.status === "active").length,
      totalSettled: basketsWithLegs.filter((b) => b.status === "settled").length,
      totalRedeemable: basketsWithLegs.reduce((sum, b) => sum + b.redeemableCount, 0),
    });
  } catch (err) {
    console.error("Basket list error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
