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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_GROK_ASSISTANT_MODEL,
  DEFAULT_OPENAI_ASSISTANT_MODEL,
  defaultModelForProvider,
  normalizeAssistantProvider,
  type AssistantLlmProvider,
} from "@/lib/integrations/platform-openai-config";
import { useRegisterSuperadminIntegrationSave } from "@/lib/superadmin/integrations-save-registry";
import { saveSuperadminPlatformIntegration } from "@/lib/superadmin/platform-integrations-api";
import type { PlatformIntegrationRow } from "@/lib/types/platform-integration";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

type OpenaiUiConfig = {
  api_key_configured?: boolean;
  provider?: AssistantLlmProvider;
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
  const [provider, setProvider] = useState<AssistantLlmProvider>(
    normalizeAssistantProvider(ui.provider),
  );
  const [model, setModel] = useState(
    ui.model?.trim() || defaultModelForProvider(provider),
  );
  const apiKeyConfigured = Boolean(ui.api_key_configured);

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        enabled: row.enabled,
        provider: normalizeAssistantProvider(ui.provider),
        model:
          ui.model?.trim() ||
          defaultModelForProvider(normalizeAssistantProvider(ui.provider)),
      }),
    [row.enabled, ui.model, ui.provider],
  );

  const dirty = useMemo(() => {
    const current = JSON.stringify({
      enabled,
      provider,
      model: model.trim(),
    });
    return current !== snapshot || apiKey.length > 0;
  }, [enabled, provider, model, apiKey, snapshot]);

  useEffect(() => {
    setEnabled(row.enabled);
    setApiKey("");
    const nextProvider = normalizeAssistantProvider(ui.provider);
    setProvider(nextProvider);
    setModel(ui.model?.trim() || defaultModelForProvider(nextProvider));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot
  }, [snapshot]);

  const save = async () => {
    if (enabled && !apiKeyConfigured && !apiKey.trim()) {
      toast.error(
        provider === "grok"
          ? "xAI / Grok API-Key erforderlich."
          : "OpenAI API-Key erforderlich.",
      );
      return;
    }

    const config: Record<string, unknown> = {
      provider,
      model: model.trim() || defaultModelForProvider(provider),
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
    toast.success("Assistent gespeichert.");
    setApiKey("");
    onSaved();
  };

  useRegisterSuperadminIntegrationSave("openai", dirty, save);

  return (
    <SuperadminIntegrationPanel
      title="Assistent (OpenAI / Grok)"
      description="API-Key für den Dashboard-Chatbot. OpenAI oder Grok (xAI) — der Key wird nur serverseitig genutzt und nie ins UI zurückgegeben."
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
        <div className="space-y-1.5">
          <Label htmlFor="assistant-provider">Anbieter</Label>
          <Select
            value={provider}
            onValueChange={(v) => {
              if (typeof v !== "string") return;
              const next = normalizeAssistantProvider(v);
              setProvider(next);
              setModel((prev) => {
                const wasDefault =
                  !prev.trim() ||
                  prev === DEFAULT_OPENAI_ASSISTANT_MODEL ||
                  prev === DEFAULT_GROK_ASSISTANT_MODEL;
                return wasDefault ? defaultModelForProvider(next) : prev;
              });
            }}
            disabled={!enabled}
          >
            <SelectTrigger
              id="assistant-provider"
              className={appSelectTriggerAccentCn("h-9 w-full")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="grok">Grok (xAI)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <SecretInput
          id="openai-api-key"
          label={provider === "grok" ? "xAI API-Key" : "OpenAI API-Key"}
          disabled={!enabled}
          configured={apiKeyConfigured}
          value={apiKey}
          onChange={setApiKey}
          placeholder={
            enabled && !apiKeyConfigured
              ? provider === "grok"
                ? "xai-… eingeben"
                : "sk-… eingeben"
              : undefined
          }
          hint={
            apiKeyConfigured
              ? "Punkte = gespeicherter Key. Feld anklicken zum Ersetzen."
              : provider === "grok"
                ? "Key unter console.x.ai"
                : undefined
          }
        />
        <div className="space-y-1.5">
          <Label htmlFor="openai-model">Modell</Label>
          <Input
            id="openai-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={defaultModelForProvider(provider)}
            disabled={!enabled}
          />
        </div>
      </div>
    </SuperadminIntegrationPanel>
  );
}
