"use client";

import { ModuleHomeKeepAliveShell } from "@/components/navigation/module-home-keep-alive-shell";
import { AccountingInvoicesScreen } from "@/components/accounting/accounting-invoices-screen";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";

const BUCHFUEHRUNG_NAV: readonly ModuleSubnavItem[] = [
  { href: "/dashboard/buchfuehrung/rechnungen", label: "Rechnungen", matchMode: "exact", activeWhen: ["/dashboard/buchfuehrung"] },
  { href: "/dashboard/buchfuehrung/angebote", label: "Angebote", matchMode: "exact" },
  { href: "/dashboard/buchfuehrung/belege", label: "Belege", matchMode: "exact" },
  { href: "/dashboard/buchfuehrung/kasse", label: "Kasse", matchMode: "exact" },
  { href: "/dashboard/buchfuehrung/statistiken", label: "Statistiken", matchMode: "exact" },
  { href: "/dashboard/buchfuehrung/einstellungen", label: "Einstellungen", matchMode: "exact" },
];

export function AccountingInvoicesKeepAliveScreen({
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
      title="Buchführung"
      subnavAriaLabel="Buchführung-Bereiche"
      subnavItems={BUCHFUEHRUNG_NAV}
    >
      <AccountingInvoicesScreen active={active} />
    </ModuleHomeKeepAliveShell>
  );
}
