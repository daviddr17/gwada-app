"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { SuperadminIntegrationPanel } from "@/components/superadmin/superadmin-integration-panel";
import { INTEGRATION_PANEL_ACCENT } from "@/lib/ui/integration-panel-accent";
import { SuperadminIntegrationStatusBadges } from "@/components/superadmin/superadmin-integration-status-badges";
import { SecretInput } from "@/components/ui/secret-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_OPENAI_ASSISTANT_MODEL } from "@/lib/integrations/platform-openai-config";
import { useRegisterSuperadminIntegrationSave } from "@/lib/superadmin/integrations-save-registry";
import { saveSuperadminPlatformIntegration } from "@/lib/superadmin/platform-integrations-api";
import type { PlatformIntegrationRow } from "@/lib/types/platform-integration";

type OpenaiUiConfig = {
  api_key_configured?: boolean;
  model?: string;
};

export function PlatformOpenaiFeatureCard({
  row,
  onSaved,
}: {
  row: PlatformIntegrationRow;
  onSaved: () => void;
}) {
  const ui = row.config as OpenaiUiConfig;
  const [enabled, setEnabled] = useState(row.enabled);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(
    ui.model?.trim() || DEFAULT_OPENAI_ASSISTANT_MODEL,
  );
  const apiKeyConfigured = Boolean(ui.api_key_configured);

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        enabled: row.enabled,
        model: ui.model?.trim() || DEFAULT_OPENAI_ASSISTANT_MODEL,
      }),
    [row.enabled, ui.model],
  );

  const dirty = useMemo(() => {
    const current = JSON.stringify({ enabled, model: model.trim() });
    return current !== snapshot || apiKey.length > 0;
  }, [enabled, model, apiKey, snapshot]);

  useEffect(() => {
    setEnabled(row.enabled);
    setApiKey("");
    setModel(ui.model?.trim() || DEFAULT_OPENAI_ASSISTANT_MODEL);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot
  }, [snapshot]);

  const save = async () => {
    if (enabled && !apiKeyConfigured && !apiKey.trim()) {
      toast.error("OpenAI API-Key erforderlich.");
      return;
    }

    const config: Record<string, unknown> = {
      model: model.trim() || DEFAULT_OPENAI_ASSISTANT_MODEL,
    };
    if (apiKey.trim()) {
      config.api_key = apiKey.trim();
    }

    const { ok, error } = await saveSuperadminPlatformIntegration(
      "openai",
      enabled,
      config,
    );
    if (!ok) {
      toast.error(error ?? "Speichern fehlgeschlagen.");
      return;
    }
    toast.success("Assistent (OpenAI) gespeichert.");
    setApiKey("");
    onSaved();
  };

  useRegisterSuperadminIntegrationSave("openai", dirty, save);

  return (
    <SuperadminIntegrationPanel
      title="Assistent (OpenAI)"
      description="API-Key für den Dashboard-Chatbot. Der Key wird nur serverseitig genutzt und nie ins UI zurückgegeben."
      icon={<Sparkles className="size-5" aria-hidden />}
      accentColor={INTEGRATION_PANEL_ACCENT.openai}
      badges={
        <SuperadminIntegrationStatusBadges
          enabled={enabled}
          configured={apiKeyConfigured}
          configuredLabel="API-Key hinterlegt"
        />
      }
      headerTrailing={
        <Switch
          checked={enabled}
          onCheckedChange={(v) => setEnabled(v === true)}
          aria-label="Assistent aktivieren"
        />
      }
    >
      <div className="space-y-3">
        <SecretInput
          id="openai-api-key"
          label="OpenAI API-Key"
          disabled={!enabled}
          configured={apiKeyConfigured}
          value={apiKey}
          onChange={setApiKey}
          placeholder={
            enabled && !apiKeyConfigured ? "sk-… eingeben" : undefined
          }
          hint={
            apiKeyConfigured
              ? "Punkte = gespeicherter Key. Feld anklicken zum Ersetzen."
              : undefined
          }
        />
        <div className="space-y-1.5">
          <Label htmlFor="openai-model">Modell</Label>
          <Input
            id="openai-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={DEFAULT_OPENAI_ASSISTANT_MODEL}
            disabled={!enabled}
          />
        </div>
      </div>
    </SuperadminIntegrationPanel>
  );
}
