"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudSun } from "lucide-react";
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

type WeatherUiConfig = {
  api_key_configured?: boolean;
};

export function PlatformWeatherFeatureCard({
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
  const ui = row.config as WeatherUiConfig;
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
      toast.error("Visual Crossing API-Key erforderlich.");
      return;
    }

    const config: Record<string, unknown> = {};
    if (apiKey.trim()) {
      config.api_key = apiKey.trim();
    }

    const { ok, error } = await saveSuperadminPlatformIntegration(
      "weather",
      enabled,
      config,
    );
    if (!ok) {
      toast.error(error ?? "Speichern fehlgeschlagen.");
      return;
    }
    toast.success("Wetter-API gespeichert.");
    setApiKey("");
    onSaved();
  };

  useRegisterSuperadminIntegrationSave("weather", dirty, save);

  const keyRequired = enabled && !apiKeyConfigured;

  return (
    <SuperadminIntegrationPanel
      title="Wetter (Visual Crossing)"
      description="API-Key für das Dashboard-Wetter-Widget aller Restaurants. Der Key wird nur serverseitig genutzt und nie ins UI zurückgegeben."
      icon={<CloudSun className="size-5" aria-hidden />}
      accentColor={INTEGRATION_PANEL_ACCENT.weather}
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
          aria-label="Wetter-API aktivieren"
        />
      }
    >
      <SecretInput
        id="platform-weather-key"
        label="Visual Crossing API-Key"
        disabled={!enabled}
        configured={apiKeyConfigured}
        value={apiKey}
        onChange={setApiKey}
        placeholder={keyRequired ? "API-Key eingeben" : undefined}
        hint={
          apiKeyConfigured
            ? "Punkte = gespeicherter Key. Feld anklicken zum Ersetzen."
            : undefined
        }
      />
    </SuperadminIntegrationPanel>
  );
}
