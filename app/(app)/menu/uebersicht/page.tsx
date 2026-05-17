"use client";

import { Suspense } from "react";
import { MenuOverviewScreen } from "@/components/menu/menu-overview-screen";

export default function MenuUebersichtPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] bg-background" />}>
      <MenuOverviewScreen />
    </Suspense>
  );
}
