import { MenuOverviewSkeleton } from "@/components/menu/menu-overview-skeleton";
import { AppMain } from "@/components/layout/app-main";

/** Sofortiges Speisekarten-Chrome während Soft-Nav / RSC-Flight. */
export default function MenuLoading() {
  return (
    <AppMain>
      <MenuOverviewSkeleton />
    </AppMain>
  );
}
