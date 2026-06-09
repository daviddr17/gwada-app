"use client";

import { AccountingSalesDocumentsScreen } from "@/components/accounting/accounting-sales-documents-screen";

export function AccountingInvoicesScreen() {
  return <AccountingSalesDocumentsScreen documentKind="invoice" />;
}
