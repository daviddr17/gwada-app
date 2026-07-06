"use client";

import { Suspense } from "react";
import { ReviewsScreen } from "@/components/reviews/reviews-screen";
import { ReviewsScreenSkeleton } from "@/components/reviews/reviews-screen-skeleton";

export default function BewertungenUebersichtPage() {
  return (
    <Suspense fallback={<ReviewsScreenSkeleton />}>
      <ReviewsScreen />
    </Suspense>
  );
}
