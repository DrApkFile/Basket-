/**
 * GET /api/basket/community
 *
 * List recent community baskets (public/shared).
 * Returns baskets from all users for the community view.
 */

import { NextResponse } from "next/server";
import { collection, getDocs, query, orderBy, limit, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { BasketDoc } from "@/lib/firestore-types";

export async function GET() {
  try {
    // Get only explicitly shared baskets that are still active (not settled/redeemed)
    const q = query(
      collection(db, "baskets"),
      where("shared", "==", true),
      where("status", "in", ["pending", "active"]),
      orderBy("sharedAt", "desc"),
      limit(50)
    );

    const snap = await getDocs(q);

    const baskets = await Promise.all(
      snap.docs.map(async (doc) => {
        const data = doc.data() as BasketDoc;

        // Count legs
        const legsSnap = await getDocs(collection(db, "baskets", doc.id, "legs"));
        const legCount = legsSnap.size;

        return {
          id: doc.id,
          asset: data.asset,
          totalSpent: data.totalSpent,
          legCount,
          status: data.status,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
          sharedAt: data.sharedAt?.toDate?.()?.toISOString() ?? null,
        };
      })
    );

    return NextResponse.json({ baskets });
  } catch (err) {
    console.error("Community baskets error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
