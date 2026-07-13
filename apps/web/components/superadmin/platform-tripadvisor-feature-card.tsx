"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { SuperadminIntegrationPanel } from "@/components/superadmin/superadmin-integration-panel";
import { INTEGRATION_PANEL_ACCENT } from "@/lib/ui/integration-panel-accent";
import { SuperadminIntegrationStatusBadges } from "@/components/superadmin/superadmin-integration-status-badges";
import { SecretInput } from "@/components/ui/secret-input";
import { Switch } from "@/components/ui/switch";
import { useRegisterSuperadminIntegrationSave } from "@/lib/superadmin/integrations-save-registry";
import { saveSuperadminPlatformIntegration } from "@/lib/superadmin/platform-integrations-api";
import type { PlatformIntegrationRow } from "@/lib/types/platform-integration";
import type { SuperadminIntegrationConnectionHealth } from "@/lib/types/superadmin-ops-status";

type TripadvisorUiConfig = {
  api_key_configured?: boolean;
};

export function PlatformTripadvisorFeatureCard({
  row,
  onSaved,
  connection,
  connectionChecking,
}: {
  row: PlatformIntegrationRow;
  onSaved: () => void;
  connection?: SuperadminIntegrationConnectionHealth | null;
  connectionChecking?: boolean;
}) {
  const ui = row.config as TripadvisorUiConfig;
  const [enabled, setEnabled] = useState(row.enabled);
  const [apiKey, setApiKey] = useState("");
  const apiKeyConfigured = Boolean(ui.api_key_configured);

  const snapshot = useMemo(
    () => JSON.stringify({ enabled: row.enabled }),
    [row.enabled],
  );

  const dirty = useMemo(() => {
    const current = JSON.stringify({ enabled });
    return current !== snapshot || apiKey.length > 0;
  }, [enabled, apiKey, snapshot]);

  useEffect(() => {
    setEnabled(row.enabled);
    setApiKey("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot
  }, [snapshot]);

  const save = async () => {
    if (enabled && !apiKeyConfigured && !apiKey.trim()) {
      toast.error("TripAdvisor API-Key erforderlich.");
      return;
    }

    const config: Record<string, unknown> = {};
    if (apiKey.trim()) {
      config.api_key = apiKey.trim();
    }

    const { ok, error } = await saveSuperadminPlatformIntegration(
      "tripadvisor",
      enabled,
      config,
    );
    if (!ok) {
      toast.error(error ?? "Speichern fehlgeschlagen.");
      return;
    }
    toast.success("TripAdvisor-Integration gespeichert.");
    setApiKey("");
    onSaved();
  };

  useRegisterSuperadminIntegrationSave("tripadvisor", dirty, save);

  const keyRequired = enabled && !apiKeyConfigured;

  return (
    <SuperadminIntegrationPanel
      title="TripAdvisor (Terra API)"
      description="Partner-API-Key für Bewertungen und Galerie-Fotos aller Restaurants. Der Key wird nur serverseitig genutzt — Restaurants hinterlegen ihre Location-ID unter Einstellungen → Integrationen."
      icon={<MapPin className="size-5" aria-hidden />}
      accentColor={INTEGRATION_PANEL_ACCENT.tripadvisor}
      badges={
        <SuperadminIntegrationStatusBadges
          enabled={enabled}
          configured={apiKeyConfigured}
          configuredLabel="API-Key hinterlegt"
          connection={connection}
          connectionChecking={connectionChecking}
        />
      }
      headerTrailing={
        <Switch
          checked={enabled}
          onCheckedChange={(v) => setEnabled(v === true)}
          aria-label="TripAdvisor aktivieren"
        />
      }
    >
      <SecretInput
        id="platform-tripadvisor-key"
        label="TripAdvisor Terra API-Key"
        disabled={!enabled}
        configured={apiKeyConfigured}
        value={apiKey}
        onChange={setApiKey}
        placeholder={keyRequired ? "API-Key eingeben" : undefined}
        hint={
          apiKeyConfigured
            ? "Punkte = gespeicherter Key. Feld anklicken zum Ersetzen."
            : "Aus dem TripAdvisor Partner-Dashboard (Terra API)."
        }
      />
    </SuperadminIntegrationPanel>
  );
}
