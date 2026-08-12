"use client";

import { ModuleHomeKeepAliveShell } from "@/components/navigation/module-home-keep-alive-shell";
import { PosOverviewScreen } from "@/components/pos/pos-overview-screen";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

const POS_NAV: readonly ModuleSubnavItem[] = [
  { href: APP_ROUTES.pos.overview, label: "Übersicht", matchMode: "exact", activeWhen: [APP_ROUTES.pos.root] },
  { href: APP_ROUTES.pos.orders, label: "Bestellungen", matchMode: "exact" },
  { href: APP_ROUTES.pos.receipts, label: "Quittungen", matchMode: "exact" },
  { href: APP_ROUTES.pos.giftVouchers, label: "Gutscheine", matchMode: "exact" },
  { href: APP_ROUTES.pos.statistics, label: "Statistiken", matchMode: "exact" },
  { href: APP_ROUTES.pos.reports, label: "Berichte", matchMode: "exact" },
  { href: APP_ROUTES.pos.settings, label: "Einstellungen", matchMode: "prefix" },
];

export function PosOverviewKeepAliveScreen({
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
      title="POS"
      subnavAriaLabel="POS-Bereiche"
      subnavItems={POS_NAV}
      mainClassName="px-4 pb-8 sm:px-6"
    >
      <PosOverviewScreen active={active} />
    </ModuleHomeKeepAliveShell>
  );
}
