"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import { SecretInput } from "@/components/ui/secret-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SettingsIntegrationPanel,
  integrationStatusBadgeConnected,
  integrationStatusBadgeMuted,
} from "@/components/settings/settings-integration-panel";
import { useRegisterSettingsIntegrationSave } from "@/components/settings/settings-integration-save-registry";
import {
  normalizeAssistantProvider,
  type AssistantLlmProvider,
} from "@/lib/integrations/platform-openai-config";
import type { RestaurantAssistantPublic } from "@/lib/integrations/restaurant-assistant-config";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { INTEGRATION_PANEL_ACCENT } from "@/lib/ui/integration-panel-accent";

export function AssistantIntegrationCard() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permLoading } = useRestaurantPermissions();
  const canManage = has("integrations.assistant");
  const [state, setState] = useState<RestaurantAssistantPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<AssistantLlmProvider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const apply = (data: RestaurantAssistantPublic) => {
    setState(data);
    setProvider(normalizeAssistantProvider(data.provider));
    setApiKey("");
  };

  const load = useCallback(async () => {
    if (!restaurantId) {
      setState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/integrations/assistant?${new URLSearchParams({ restaurantId })}`,
      );
      const data = (await res.json()) as RestaurantAssistantPublic & { error?: string };
      if (!res.ok) {
        if (res.status !== 403) {
          toast.error(data.error ?? "Assistent konnte nicht geladen werden.");
        }
        setLoading(false);
        return;
      }
      apply(data);
    } catch {
      toast.error("Netzwerkfehler beim Laden des Assistenten.");
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const savedProvider = normalizeAssistantProvider(state?.provider);
  const dirty = useMemo(
    () => apiKey.trim().length > 0 || provider !== savedProvider,
    [apiKey, provider, savedProvider],
  );

  const save = useCallback(async () => {
    if (!restaurantId || !canManage) return;
    const res = await fetch("/api/integrations/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, provider, apiKey }),
    });
    const data = (await res.json()) as RestaurantAssistantPublic & { error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "Speichern fehlgeschlagen.");
      return;
    }
    toast.success("Assistent gespeichert.");
    apply(data);
  }, [restaurantId, canManage, provider, apiKey]);

  useRegisterSettingsIntegrationSave("assistant", dirty && canManage, save);

  const disconnect = async () => {
    if (!restaurantId) return;
    const res = await fetch("/api/integrations/assistant", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "Entfernen fehlgeschlagen.");
      throw new Error(data.error ?? "disconnect_failed");
    }
    toast.success("Schlüssel entfernt.");
    apply({ provider: "openai", apiKeyConfigured: false });
  };

  const configured = Boolean(state?.apiKeyConfigured);

  return (
    <>
      <SettingsIntegrationPanel
        title="Assistent"
        description="Eigenen OpenAI- oder Grok-Schlüssel hinterlegen. Damit antwortet der Assistent in diesem Restaurant. Ohne Schlüssel bleibt der Chat offline."
        icon={<Sparkles className="size-5" aria-hidden />}
        accentColor={INTEGRATION_PANEL_ACCENT.openai}
        badge={
          configured
            ? integrationStatusBadgeConnected("API-Key hinterlegt")
            : integrationStatusBadgeMuted("Nicht verbunden")
        }
        summaryLine={
          configured
            ? provider === "grok"
              ? "Grok-Schlüssel hinterlegt"
              : "OpenAI-Schlüssel hinterlegt"
            : undefined
        }
        loading={permLoading || !workspaceReady || loading}
        denied={!canManage}
        deniedMessage="Deine Position darf den Assistenten nicht verbinden. Bitte wende dich an eine Person mit Administrator-Rechten."
        noRestaurant={workspaceReady && !restaurantId}
        noRestaurantMessage="Wähle zuerst ein Restaurant im Workspace, um den Assistenten zu verbinden."
      >
        <div className="space-y-1.5">
          <Label htmlFor="restaurant-assistant-provider">Anbieter</Label>
          <Select
            value={provider}
            onValueChange={(value) => {
              if (typeof value !== "string") return;
              setProvider(normalizeAssistantProvider(value));
            }}
          >
            <SelectTrigger
              id="restaurant-assistant-provider"
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
          id="restaurant-assistant-key"
          label={provider === "grok" ? "xAI API-Key" : "OpenAI API-Key"}
          configured={configured}
          value={apiKey}
          onChange={setApiKey}
          placeholder={
            !configured
              ? provider === "grok"
                ? "xai-… eingeben"
                : "sk-… eingeben"
              : undefined
          }
          hint={
            configured
              ? "Punkte = gespeicherter Key. Feld anklicken zum Ersetzen."
              : provider === "grok"
                ? "Key unter console.x.ai. Er wird nicht wieder angezeigt."
                : "Der Key wird nicht wieder angezeigt."
          }
        />
        {configured ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl"
            onClick={() => setDisconnectOpen(true)}
          >
            Schlüssel entfernen
          </Button>
        ) : null}
      </SettingsIntegrationPanel>
      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="Schlüssel entfernen?"
        description="Der Assistent dieses Restaurants antwortet danach offline. Es wird kein Modell aufgerufen."
        confirmLabel="Entfernen"
        cancelLabel="Abbrechen"
        onConfirm={disconnect}
      />
    </>
  );
}
