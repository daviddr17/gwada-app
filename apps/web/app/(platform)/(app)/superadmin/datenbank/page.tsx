"use client";

import { SuperadminDatabasePanel } from "@/components/superadmin/superadmin-database-panel";

export default function SuperadminDatenbankPage() {
  return (
    <div className="space-y-6 pt-2">
      <p className="text-sm text-muted-foreground">
        Live-Deploy (DB + App), Contabo-VPS-Neustart, Postgres-Status und
        Repo-Orientierung — ohne Passwörter oder API-Keys. WAHA-Hosts liegen
        unter WAHA.
      </p>
      <SuperadminDatabasePanel />
    </div>
  );
}
