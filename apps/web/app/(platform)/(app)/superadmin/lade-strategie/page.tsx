"use client";

import { SuperadminCacheStrategyPanel } from "@/components/superadmin/superadmin-cache-strategy-panel";

export default function SuperadminLadeStrategiePage() {
  return (
    <div className="space-y-6 pt-2">
      <p className="text-sm text-muted-foreground">
        Wie Daten geladen, gecached und invalidiert werden — automatisch aus{" "}
        <code className="font-mono text-xs">module-data-cache-policy.ts</code>.
<<<<<<< HEAD
        Dashboard- und Superadmin-Zone: Vite/TanStack SPA (Client-Routing,
        Route-Preload); Provider bleiben im Next-(app)-Layout. Full-Load nur App
        ↔ Superadmin über{" "}
=======
        Dashboard-Zone: Vite/TanStack SPA (Client-Routing, Route-Preload);
        Provider und React Query bleiben im Next-(app)-Layout. Superadmin/
        Workspace: Next Soft-Nav. Full-Load nur App ↔ Superadmin über{" "}
>>>>>>> origin/cursor/superadmin-spa-docs-inventory-draft-d944
        <code className="font-mono text-xs">/zone/enter</code>. Warm-Prefetch +
        Batch im App-Layout; Realtime in{" "}
        <code className="font-mono text-xs">AppModuleLiveProviders</code>{" "}
        (Zone-Level). SoftNavLock = Pending-UI. Display-Kiosk: eigene Session,
        Live-Signal 2s + silent Refetch.
      </p>
      <SuperadminCacheStrategyPanel />
    </div>
  );
}
