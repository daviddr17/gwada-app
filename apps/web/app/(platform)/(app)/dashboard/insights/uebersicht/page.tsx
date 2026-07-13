"use client";

import { Suspense } from "react";
import { InsightsOverviewScreen } from "@/components/insights/insights-overview-screen";
import { InsightsOverviewSkeleton } from "@/components/insights/insights-overview-skeleton";

export default function InsightsUebersichtPage() {
  return (
    <Suspense fallback={<InsightsOverviewSkeleton />}>
      <InsightsOverviewScreen />
    </Suspense>
  );
}
