"use client";

import { ModuleHomeKeepAliveShell } from "@/components/navigation/module-home-keep-alive-shell";
import { AccountingInvoicesScreen } from "@/components/accounting/accounting-invoices-screen";
import { BUCHFUEHRUNG_MODULE_NAV } from "@/components/accounting/buchfuehrung-module-nav";

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
      subnavItems={BUCHFUEHRUNG_MODULE_NAV}
    >
      <AccountingInvoicesScreen active={active} />
    </ModuleHomeKeepAliveShell>
  );
}
