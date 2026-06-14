"use client";

import { SuperadminCacheStrategyPanel } from "@/components/superadmin/superadmin-cache-strategy-panel";

export default function SuperadminLadeStrategiePage() {
  return (
    <div className="space-y-6 pt-2">
      <p className="text-sm text-muted-foreground">
        Wie Daten geladen, gecached und invalidiert werden — automatisch aus{" "}
        <code className="font-mono text-xs">module-data-cache-policy.ts</code>.
        Soft-Nav hält Provider gemountet; Realtime nicht route-conditional.
      </p>
      <SuperadminCacheStrategyPanel />
    </div>
  );
}
