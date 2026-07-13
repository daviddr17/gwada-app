"use client";

import { Suspense } from "react";
import { InsightsStatisticsScreen } from "@/components/insights/insights-statistics-screen";
import { InsightsStatisticsSkeleton } from "@/components/insights/insights-statistics-skeleton";

export default function InsightsStatistikenPage() {
  return (
    <Suspense fallback={<InsightsStatisticsSkeleton />}>
      <InsightsStatisticsScreen />
    </Suspense>
  );
}
