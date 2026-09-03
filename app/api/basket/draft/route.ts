/**
 * GET /api/basket/draft?draftId=xxx
 *
 * Fetch a saved draft for editing.
 */

import { NextRequest, NextResponse } from "next/server";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const draftId = searchParams.get("draftId");

  if (!draftId) {
    return NextResponse.json({ error: "draftId required" }, { status: 400 });
  }

  const draftRef = doc(db, "basket_drafts", draftId);
  const draftSnap = await getDoc(draftRef);

  if (!draftSnap.exists()) {
    return NextResponse.json({ error: "Draft not found or expired" }, { status: 404 });
  }

  const draft = draftSnap.data();

  // Check if draft expired
  if (draft.expiresAt && draft.expiresAt.toDate() < new Date()) {
    // Clean up expired draft
    await deleteDoc(draftRef);
    return NextResponse.json({ error: "Draft expired. Please copy again." }, { status: 410 });
  }

  return NextResponse.json({
    draftId,
    ...draft,
    createdAt: draft.createdAt?.toDate?.()?.toISOString() ?? null,
    expiresAt: draft.expiresAt?.toDate?.()?.toISOString() ?? null,
  });
}

/**
 * DELETE /api/basket/draft?draftId=xxx
 *
 * Delete a draft after it's been used or cancelled.
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const draftId = searchParams.get("draftId");

  if (!draftId) {
    return NextResponse.json({ error: "draftId required" }, { status: 400 });
  }

  const draftRef = doc(db, "basket_drafts", draftId);
  await deleteDoc(draftRef);

  return NextResponse.json({ success: true });
}
