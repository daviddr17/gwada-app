"use client";

import { SuperadminCacheStrategyPanel } from "@/components/superadmin/superadmin-cache-strategy-panel";

export default function SuperadminLadeStrategiePage() {
  return (
    <div className="space-y-6 pt-2">
      <p className="text-sm text-muted-foreground">
        Wie Daten geladen, gecached und invalidiert werden — pro Modul
        dokumentiert. Basis für Team-Entscheidungen bei neuen Features.
      </p>
      <SuperadminCacheStrategyPanel />
    </div>
  );
}
