"use client";

import { SuperadminComplianceTemplatesPanel } from "@/components/superadmin/superadmin-compliance-templates-panel";

export default function SuperadminChecklistenVorlagenPage() {
  return (
    <div className="space-y-6 pt-2">
      <p className="text-sm text-muted-foreground">
        Zentrale HACCP-Checklistenvorlagen — Restaurants importieren Kopien unter
        Checklisten → Vorlagen (Standardvorlagen importieren).
      </p>
      <SuperadminComplianceTemplatesPanel />
    </div>
  );
}
