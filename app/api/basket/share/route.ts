/**
 * POST /api/basket/share
 *
 * Toggle sharing for a basket (add to community tab).
 * Only the basket owner can share/unshare.
 */

import { NextResponse } from "next/server";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BasketDoc } from "@/lib/firestore-types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { basketId, userId, share } = body;

    if (!basketId || !userId) {
      return NextResponse.json(
        { error: "basketId and userId required" },
        { status: 400 }
      );
    }

    // Get basket
    const basketRef = doc(db, "baskets", basketId);
    const basketSnap = await getDoc(basketRef);

    if (!basketSnap.exists()) {
      return NextResponse.json({ error: "Basket not found" }, { status: 404 });
    }

    const basket = basketSnap.data() as BasketDoc;

    // Verify ownership
    if (basket.userId !== userId) {
      return NextResponse.json(
        { error: "Only the basket owner can share" },
        { status: 403 }
      );
    }

    // Don't allow sharing settled/redeemed baskets
    if (share && (basket.status === "settled" || basket.status === "redeemed")) {
      return NextResponse.json(
        { error: "Cannot share resolved baskets" },
        { status: 400 }
      );
    }

    // Update sharing status
    await updateDoc(basketRef, {
      shared: share === true,
      sharedAt: share ? serverTimestamp() : null,
    });

    return NextResponse.json({
      success: true,
      shared: share === true,
    });
  } catch (err) {
    console.error("Share basket error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
