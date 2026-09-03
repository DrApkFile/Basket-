/**
 * DELETE /api/basket/delete
 *
 * Soft-delete a basket from the user's view.
 * - Sets deleted: true flag (filtered out of queries)
 * - Also unshares if shared (removes from community feed)
 * - Does NOT affect on-chain positions (those are immutable once placed)
 */

import { NextRequest, NextResponse } from "next/server";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BasketDoc } from "@/lib/firestore-types";

export async function DELETE(request: NextRequest) {
  try {
    const { basketId, userId } = (await request.json()) as {
      basketId: string;
      userId: string;
    };

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
        { error: "You can only delete your own baskets" },
        { status: 403 }
      );
    }

    // Soft delete: set deleted flag and unshare
    await updateDoc(basketRef, {
      deleted: true,
      deletedAt: serverTimestamp(),
      shared: false, // Remove from community feed
      sharedAt: null,
    });

    return NextResponse.json({
      success: true,
      message: "Basket removed from your view. On-chain positions are unaffected.",
    });
  } catch (err) {
    console.error("Basket delete error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
