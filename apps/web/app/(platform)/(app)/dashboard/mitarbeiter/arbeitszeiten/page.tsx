"use client";

import { Suspense } from "react";
import { StaffWorkHoursScreen } from "@/components/staff/staff-work-hours-screen";

export default function MitarbeiterArbeitszeitenPage() {
  return (
    <Suspense fallback={null}>
      <StaffWorkHoursScreen />
    </Suspense>
  );
}
