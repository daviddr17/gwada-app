"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { SuperadminIntegrationConnectionBadge } from "@/components/superadmin/superadmin-integration-connection-badge";
import type { SuperadminIntegrationConnectionHealth } from "@/lib/types/superadmin-ops-status";

export const superadminIntegrationEnabledBadgeClassName =
  "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";

export const superadminIntegrationCredentialBadgeClassName = "text-xs";

/** Einheitlicher Schalter-Status auf allen Superadmin-Integrationskarten. */
export function SuperadminIntegrationEnabledBadge({
  enabled,
}: {
  enabled: boolean;
}) {
  return enabled ? (
    <Badge variant="outline" className={superadminIntegrationEnabledBadgeClassName}>
      Aktiv
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Inaktiv
    </Badge>
  );
}

/** Secret/API-Key/Passwort — nur Plattform-DB, nie Klartext ans UI. */
export function SuperadminIntegrationCredentialBadge({
  configured,
  configuredLabel = "Zugangsdaten hinterlegt",
}: {
  configured?: boolean;
  configuredLabel?: string;
}) {
  if (!configured) return null;
  return (
    <Badge
      variant="secondary"
      className={superadminIntegrationCredentialBadgeClassName}
    >
      {configuredLabel}
    </Badge>
  );
}

export function SuperadminIntegrationStatusBadges({
  enabled,
  configured,
  configuredLabel,
  connection,
  connectionChecking,
  extra,
}: {
  enabled: boolean;
  configured?: boolean;
  configuredLabel?: string;
  connection?: SuperadminIntegrationConnectionHealth | null;
  connectionChecking?: boolean;
  extra?: ReactNode;
}) {
  return (
    <>
      <SuperadminIntegrationEnabledBadge enabled={enabled} />
      <SuperadminIntegrationCredentialBadge
        configured={configured}
        configuredLabel={configuredLabel}
      />
      <SuperadminIntegrationConnectionBadge
        connection={connection}
        checking={connectionChecking}
      />
      {extra}
    </>
  );
}
