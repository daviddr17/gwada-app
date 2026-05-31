"use client";

import { SuperadminChangelogPanel } from "@/components/superadmin/superadmin-changelog-panel";

export default function SuperadminChangelogPage() {
  return (
    <div className="space-y-6 pt-2">
      <p className="text-sm text-muted-foreground">
        Changelog manuell pflegen — Einträge für Kunden oder nur für
        Superadmins. Endkunden sehen interne Einträge nicht.
      </p>
      <SuperadminChangelogPanel />
    </div>
  );
}
