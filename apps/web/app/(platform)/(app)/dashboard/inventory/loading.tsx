import { InventoryScreenSkeleton } from "@/components/inventory/inventory-screen-skeleton";
import { AppMain } from "@/components/layout/app-main";

/** Sofortiges Bestand-Chrome während Soft-Nav / RSC-Flight. */
export default function InventoryLoading() {
  return (
    <AppMain>
      <InventoryScreenSkeleton />
    </AppMain>
  );
}
