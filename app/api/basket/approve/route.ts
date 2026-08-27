/**
 * POST /api/basket/approve
 *
 * Called AFTER client places orders. Creates the Firestore basket record.
 *
 * Flow:
 * 1. Client calls /api/basket/construct → gets proposal
 * 2. User approves → client places orders (needs wallet signature)
 * 3. Client calls this route with order results
 * 4. Server verifies on-chain status and creates Firestore records
 *
 * SECURITY: Server independently verifies each order exists on-chain
 * before writing to Firestore. Never trust client-provided status.
 */

import { NextRequest, NextResponse } from "next/server";
import { createBasket } from "@/lib/firestore-server";
import type { BasketProposal } from "@/lib/firestore-types";
import type { OrderResult } from "@/lib/batch-orders";

interface ApproveRequest {
  userId: string;
  proposal: BasketProposal;
  orderResults: OrderResult[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ApproveRequest;
    const { userId, proposal, orderResults } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    if (!proposal || !proposal.legs || proposal.legs.length === 0) {
      return NextResponse.json({ error: "Invalid proposal" }, { status: 400 });
    }
    if (!orderResults || orderResults.length === 0) {
      return NextResponse.json({ error: "No order results provided" }, { status: 400 });
    }

    // Filter to only successful orders
    const successfulOrders = orderResults.filter((r) => r.success);
    if (successfulOrders.length === 0) {
      return NextResponse.json({ error: "No orders succeeded" }, { status: 400 });
    }

    // Map to the format createBasket expects
    const legResults = successfulOrders.map((r) => ({
      marketId: r.marketId,
      orderId: r.orderId,
      txHash: r.txHash,
      filled: r.filled,
    }));

    // Create basket in Firestore
    // createBasket will verify on-chain status before writing each leg
    const basketId = await createBasket(userId, proposal, legResults);

    return NextResponse.json({
      basketId,
      legsCreated: legResults.length,
      message: "Basket created successfully",
    });
  } catch (err) {
    console.error("Basket approve error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
