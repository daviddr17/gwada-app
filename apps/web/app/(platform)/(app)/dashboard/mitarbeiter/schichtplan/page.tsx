"use client";

import { Suspense } from "react";
import { StaffShiftPlanScreen } from "@/components/staff/shift-plan/staff-shift-plan-screen";

export default function MitarbeiterSchichtplanPage() {
  return (
    <Suspense fallback={null}>
      <StaffShiftPlanScreen />
    </Suspense>
  );
}
