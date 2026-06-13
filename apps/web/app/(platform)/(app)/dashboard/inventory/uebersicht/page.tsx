"use client";

import { Suspense } from "react";
import { InventoryScreen } from "@/components/inventory/inventory-screen";

export default function InventoryOverviewPage() {
  return (
    <Suspense fallback={null}>
      <InventoryScreen />
    </Suspense>
  );
}
