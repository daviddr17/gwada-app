"use client";

import { SuperadminDatabasePanel } from "@/components/superadmin/superadmin-database-panel";

export default function SuperadminDatenbankPage() {
  return (
    <div className="space-y-6 pt-2">
      <p className="text-sm text-muted-foreground">
        Live-Deploy, GitHub, Postgres, VPS und Repo-Orientierung für
        Entwickler — ohne Passwörter oder API-Keys.
      </p>
      <SuperadminDatabasePanel />
    </div>
  );
}
