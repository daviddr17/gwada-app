"use client";

import { Suspense } from "react";
import { NewsScreen } from "@/components/news/news-screen";

export default function NewsOverviewPage() {
  return (
    <Suspense fallback={null}>
      <NewsScreen />
    </Suspense>
  );
}
