"use client";

import { Suspense } from "react";
import { StaffTodosScreen } from "@/components/staff/todos/staff-todos-screen";

export default function ChecklistenTodosPage() {
  return (
    <Suspense fallback={null}>
      <StaffTodosScreen />
    </Suspense>
  );
}
