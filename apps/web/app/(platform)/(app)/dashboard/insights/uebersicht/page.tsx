"use client";

import { Suspense } from "react";
import { InsightsOverviewScreen } from "@/components/insights/insights-overview-screen";

export default function InsightsUebersichtPage() {
  return (
    <Suspense fallback={null}>
      <InsightsOverviewScreen />
    </Suspense>
  );
}
