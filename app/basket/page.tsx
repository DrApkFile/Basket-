"use client";

import { Suspense } from "react";
import Dashboard from "@/components/Dashboard";

export default function BasketPage() {
  return (
    <Suspense fallback={<BasketPageLoading />}>
      <Dashboard />
    </Suspense>
  );
}

function BasketPageLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0f]">
      <p className="text-white/60">Loading...</p>
    </div>
  );
}
