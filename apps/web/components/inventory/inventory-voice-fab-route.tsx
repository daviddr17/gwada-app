"use client";

import { usePathname } from "next/navigation";
import { InventoryVoiceFab } from "@/components/inventory/inventory-voice-fab";
import type { InventoryVoiceMode } from "@/lib/inventory/purchase-order-voice-apply";

function inventoryVoiceModeFromPath(pathname: string): InventoryVoiceMode | null {
  if (pathname.startsWith("/dashboard/inventory/bestellung")) {
    return "order";
  }
  if (
    pathname === "/dashboard/inventory/uebersicht" ||
    pathname === "/dashboard/inventory"
  ) {
    return "stock";
  }
  return null;
}

export function InventoryVoiceFabRoute() {
  const pathname = usePathname();
  const mode = inventoryVoiceModeFromPath(pathname);
  if (!mode) return null;
  return <InventoryVoiceFab mode={mode} />;
}
