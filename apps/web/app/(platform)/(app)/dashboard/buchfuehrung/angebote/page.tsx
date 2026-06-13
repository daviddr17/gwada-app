"use client";

import { Suspense } from "react";
import { AccountingQuotationsScreen } from "@/components/accounting/accounting-quotations-screen";

export default function BuchfuehrungAngebotePage() {
  return (
    <Suspense fallback={null}>
      <AccountingQuotationsScreen />
    </Suspense>
  );
}
