import { Suspense } from "react";
import { ReviewsScreen } from "@/components/reviews/reviews-screen";

export default function BewertungenUebersichtPage() {
  return (
    <Suspense fallback={null}>
      <ReviewsScreen />
    </Suspense>
  );
}
