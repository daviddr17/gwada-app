"use client";

import { Suspense } from "react";
import { DocumentsOverview } from "@/components/documents/documents-overview";

export default function DokumenteUebersichtPage() {
  return (
    <Suspense fallback={null}>
      <DocumentsOverview />
    </Suspense>
  );
}
