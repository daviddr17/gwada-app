"use client";

import { InventorySubnav } from "@/components/inventory/inventory-subnav";

export function InventorySectionChrome() {
  return (
    <header className="mb-6 space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Lager
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Bestand</h1>
      </div>
      <InventorySubnav />
    </header>
  );
}
