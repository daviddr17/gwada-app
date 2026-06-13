"use client";

import { Suspense } from "react";
import { AccountingVouchersScreen } from "@/components/accounting/accounting-vouchers-screen";

export default function BuchfuehrungBelegePage() {
  return (
    <Suspense fallback={null}>
      <AccountingVouchersScreen />
    </Suspense>
  );
}
