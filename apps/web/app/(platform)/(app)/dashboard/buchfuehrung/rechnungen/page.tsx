import { Suspense } from "react";
import { AccountingInvoicesScreen } from "@/components/accounting/accounting-invoices-screen";

export default function BuchfuehrungRechnungenPage() {
  return (
    <Suspense fallback={null}>
      <AccountingInvoicesScreen />
    </Suspense>
  );
}
