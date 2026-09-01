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
    // Simple query - just get shared baskets, filter in memory to avoid composite index requirement
    const q = query(
      collection(db, "baskets"),
      where("shared", "==", true),
      limit(100)
    );

    const snap = await getDocs(q);

    // Filter to active/pending and sort in memory
    const filteredDocs = snap.docs
      .filter((doc) => {
        const data = doc.data() as BasketDoc;
        return data.status === "pending" || data.status === "active";
      })
      .sort((a, b) => {
        const aTime = (a.data() as BasketDoc).sharedAt?.toMillis?.() ?? 0;
        const bTime = (b.data() as BasketDoc).sharedAt?.toMillis?.() ?? 0;
        return bTime - aTime; // Descending
      })
      .slice(0, 50);

    // Fetch intervals from legs for each basket (in parallel for speed)
    const baskets = await Promise.all(
      filteredDocs.map(async (doc) => {
        const data = doc.data() as BasketDoc;

        // Truncate wallet address for display
        const creatorWallet = data.userId || "";
        const creatorDisplay = creatorWallet
          ? `${creatorWallet.slice(0, 6)}...${creatorWallet.slice(-4)}`
          : "Unknown";

        // Fetch legs to get intervals
        let intervals: string[] = [];
        try {
          const legsSnap = await getDocs(collection(db, "baskets", doc.id, "legs"));
          const legIntervals = legsSnap.docs.map((legDoc) => legDoc.data().interval as string);
          intervals = [...new Set(legIntervals)]; // Unique intervals
        } catch {
          // Ignore errors, just return empty intervals
        }

        return {
          id: doc.id,
          asset: data.asset,
          totalSpent: data.totalSpent,
          legCount: data.legCount ?? intervals.length ?? 0,
          intervals, // e.g., ["5min", "15min"]
          status: data.status,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
          sharedAt: data.sharedAt?.toDate?.()?.toISOString() ?? null,
          creatorWallet,
          creatorDisplay,
        };
      })
    );

    return NextResponse.json({ baskets });
  } catch (err) {
    console.error("Community baskets error:", err);

    // Check if it's an index error - return empty array instead of failing
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes("index") || errorMsg.includes("Index")) {
      console.warn("Firestore index not ready, returning empty baskets");
      return NextResponse.json({ baskets: [] });
    }

    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
