"use client";

import { Suspense } from "react";
import { ReservationsOverview } from "@/components/reservations/reservations-overview";

export default function ReservierungenUebersichtPage() {
  return (
    <Suspense fallback={null}>
      <ReservationsOverview />
    </Suspense>
  );
}
