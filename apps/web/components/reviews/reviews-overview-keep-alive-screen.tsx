"use client";

import { ModuleHomeKeepAliveShell } from "@/components/navigation/module-home-keep-alive-shell";
import { ReviewsScreen } from "@/components/reviews/reviews-screen";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

const BEWERTUNGEN_NAV: readonly ModuleSubnavItem[] = [
  { href: "/dashboard/bewertungen/uebersicht", label: "Übersicht", matchMode: "exact", activeWhen: ["/dashboard/bewertungen"] },
  { href: "/dashboard/bewertungen/statistiken", label: "Statistiken", matchMode: "exact" },
  { href: "/dashboard/bewertungen/einbinden", label: "Einbinden", matchMode: "prefix" },
  { href: "/dashboard/bewertungen/einstellungen", label: "Einstellungen", matchMode: "prefix" },
];

export function ReviewsOverviewKeepAliveScreen({
  active,
  showChrome = active,
}: {
  active: boolean;
  showChrome?: boolean;
}) {
  return (
    <ModuleHomeKeepAliveShell
      active={active}
      showChrome={showChrome}
      title="Bewertungen"
      subnavAriaLabel="Bewertungen-Bereiche"
      subnavItems={BEWERTUNGEN_NAV}
    >
      <ReviewsScreen active={active} />
    </ModuleHomeKeepAliveShell>
  );
}
