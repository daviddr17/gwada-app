"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LexofficeGlyph } from "@/components/icons/lexoffice-glyph";
import { SuperadminIntegrationPanel } from "@/components/superadmin/superadmin-integration-panel";
import { SuperadminIntegrationStatusBadges } from "@/components/superadmin/superadmin-integration-status-badges";
import { Switch } from "@/components/ui/switch";
import { useRegisterSuperadminIntegrationSave } from "@/lib/superadmin/integrations-save-registry";
import { saveSuperadminPlatformIntegration } from "@/lib/superadmin/platform-integrations-api";
import type { PlatformIntegrationRow } from "@/lib/types/platform-integration";

export function PlatformLexofficeFeatureCard({
  row,
  onSaved,
}: {
  row: PlatformIntegrationRow;
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(row.enabled);

  const snapshot = useMemo(
    () => JSON.stringify({ enabled: row.enabled }),
    [row.enabled],
  );

  const dirty = useMemo(() => {
    const current = JSON.stringify({ enabled });
    return current !== snapshot;
  }, [enabled, snapshot]);

  useEffect(() => {
    setEnabled(row.enabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot
  }, [snapshot]);

  const save = async () => {
    const { ok, error } = await saveSuperadminPlatformIntegration(
      "lexoffice",
      enabled,
      {},
    );
    if (!ok) {
      toast.error(error ?? "Speichern fehlgeschlagen.");
      return;
    }
    toast.success("Lexware Office gespeichert.");
    onSaved();
  };

  useRegisterSuperadminIntegrationSave("lexoffice", dirty, save);

  return (
    <SuperadminIntegrationPanel
      title="Lexware Office"
      description="Buchhaltung und Rechnungen (Lexware Office, ehem. Lexoffice). API-Keys werden pro Restaurant unter Einstellungen → Integrationen hinterlegt — hier nur die Plattform-Freischaltung."
      icon={<LexofficeGlyph />}
      badges={
        <SuperadminIntegrationStatusBadges
          enabled={enabled}
          configured={enabled}
          configuredLabel="Für Restaurants freigeschaltet"
        />
      }
      headerTrailing={
        <Switch
          checked={enabled}
          onCheckedChange={(v) => setEnabled(v === true)}
          aria-label="Lexware Office aktivieren"
        />
      }
    >
      <p className="text-sm text-muted-foreground">
        Restaurants verbinden sich mit einem{" "}
        <a
          href="https://app.lexware.de/addons/public-api"
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline underline-offset-2"
        >
          öffentlichen API-Key
        </a>{" "}
        aus Lexware. Die Verbindung wird über{" "}
        <span className="font-mono text-xs">GET /v1/profile</span> geprüft.
      </p>
    </SuperadminIntegrationPanel>
  );
}
