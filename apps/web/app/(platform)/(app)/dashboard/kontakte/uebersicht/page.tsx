"use client";

import { Suspense } from "react";
import { ContactsOverview } from "@/components/contacts/contacts-overview";

export default function KontakteUebersichtPage() {
  return (
    <Suspense fallback={null}>
      <ContactsOverview />
    </Suspense>
  );
}
