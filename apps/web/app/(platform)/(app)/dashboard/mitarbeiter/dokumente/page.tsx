"use client";

import { Suspense } from "react";
import { StaffDocumentsScreen } from "@/components/staff/staff-documents-screen";

export default function MitarbeiterDokumentePage() {
  return (
    <Suspense fallback={null}>
      <StaffDocumentsScreen />
    </Suspense>
  );
}
