"use client";

import { SuperadminContractTemplatesPanel } from "@/components/superadmin/superadmin-contract-templates-panel";

export default function SuperadminContractTemplatesPage() {
  return (
    <div className="space-y-6 pt-2">
      <p className="text-sm text-muted-foreground">
        Zentrale Mustertexte für digitale Arbeitsverträge — Restaurants
        importieren Kopien in ihre Beschäftigungsverhältnisse.
      </p>
      <SuperadminContractTemplatesPanel />
    </div>
  );
}
