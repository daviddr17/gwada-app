"use client";

import { AccountingSalesDocumentsScreen } from "@/components/accounting/accounting-sales-documents-screen";

export function AccountingInvoicesScreen({ active = true }: { active?: boolean }) {
  return <AccountingSalesDocumentsScreen active={active} documentKind="invoice" />;
}
