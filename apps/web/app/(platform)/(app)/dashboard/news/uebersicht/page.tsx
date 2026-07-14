"use client";

import { Suspense } from "react";
import { NewsFeedSkeleton } from "@/components/news/news-feed-skeleton";
import { NewsScreen } from "@/components/news/news-screen";

export default function NewsOverviewPage() {
  return (
    <Suspense fallback={<NewsFeedSkeleton viewMode="list" />}>
      <NewsScreen />
    </Suspense>
  );
}
