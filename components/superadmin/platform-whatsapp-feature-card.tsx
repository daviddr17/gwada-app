"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import {
  SuperadminIntegrationPanel,
  superadminIntegrationFieldLabelClassName,
  superadminIntegrationInputClassName,
} from "@/components/superadmin/superadmin-integration-panel";
import { SecretInput } from "@/components/ui/secret-input";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useRegisterSuperadminIntegrationSave } from "@/lib/superadmin/integrations-save-registry";
import { saveSuperadminPlatformIntegration } from "@/lib/superadmin/platform-integrations-api";
import type { PlatformIntegrationRow } from "@/lib/types/platform-integration";

type WhatsappUiConfig = {
  waha_base_url?: string;
  waha_api_key_configured?: boolean;
  waha_env_fallback_only?: boolean;
};

export function PlatformWhatsappFeatureCard({
  row,
  onSaved,
}: {
  row: PlatformIntegrationRow;
  onSaved: () => void;
}) {
  const ui = row.config as WhatsappUiConfig;
  const [enabled, setEnabled] = useState(row.enabled);
  const [baseUrl, setBaseUrl] = useState(ui.waha_base_url ?? "");
  const [apiKey, setApiKey] = useState("");
  const apiKeyConfigured = Boolean(ui.waha_api_key_configured);
  const envFallbackOnly = Boolean(ui.waha_env_fallback_only);

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        enabled: row.enabled,
        baseUrl: ui.waha_base_url ?? "",
      }),
    [row.enabled, ui.waha_base_url],
  );

  const dirty = useMemo(() => {
    const current = JSON.stringify({
      enabled,
      baseUrl: baseUrl.trim(),
    });
    return current !== snapshot || apiKey.length > 0;
  }, [enabled, baseUrl, apiKey, snapshot]);

  useEffect(() => {
    setEnabled(row.enabled);
    setBaseUrl(ui.waha_base_url ?? "");
    setApiKey("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot
  }, [snapshot]);

  const save = async () => {
    if (enabled && !baseUrl.trim()) {
      toast.error("WAHA API-Link erforderlich.");
      return;
    }
    if (enabled && !apiKeyConfigured && !envFallbackOnly && !apiKey.trim()) {
      toast.error("WAHA API-Key erforderlich.");
      return;
    }

    const config: Record<string, unknown> = {
      waha_base_url: baseUrl.trim() || undefined,
    };
    if (apiKey.trim()) {
      config.waha_api_key = apiKey.trim();
    }

    const { ok, error } = await saveSuperadminPlatformIntegration(
      "whatsapp",
      enabled,
      config,
    );
    if (!ok) {
      toast.error(error ?? "Speichern fehlgeschlagen.");
      return;
    }
    toast.success("WhatsApp gespeichert.");
    setApiKey("");
    onSaved();
  };

  useRegisterSuperadminIntegrationSave("whatsapp", dirty, save);

  const keyRequired = enabled && !apiKeyConfigured && !envFallbackOnly;

  return (
    <SuperadminIntegrationPanel
      title="WhatsApp"
      description="Freischaltung für Restaurants und WAHA-Server. Der API-Key wird nie aus der Datenbank ins UI geladen — nur maskiert als gespeichert angezeigt."
      icon={<WhatsAppGlyph />}
      badges={
        <>
          {enabled ? (
            <Badge
              variant="outline"
              className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
            >
              Für Nutzer sichtbar
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Ausgeblendet
            </Badge>
          )}
          {apiKeyConfigured ? (
            <Badge variant="secondary" className="text-xs">
              API-Key hinterlegt
            </Badge>
          ) : envFallbackOnly ? (
            <Badge
              variant="outline"
              className="text-xs text-amber-800 dark:text-amber-200"
            >
              Key nur in .env
            </Badge>
          ) : null}
        </>
      }
      headerTrailing={
        <Switch
          checked={enabled}
          onCheckedChange={(v) => setEnabled(v === true)}
          aria-label="WhatsApp für Nutzer freischalten"
        />
      }
    >
      <div className="space-y-1.5">
        <Label
          htmlFor="platform-waha-url"
          className={superadminIntegrationFieldLabelClassName}
        >
          WAHA API-Link
        </Label>
        <Input
          id="platform-waha-url"
          type="url"
          disabled={!enabled}
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://waha.gwada.app"
          className={superadminIntegrationInputClassName}
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      <SecretInput
        id="platform-waha-key"
        label="WAHA API-Key"
        disabled={!enabled}
        configured={apiKeyConfigured}
        value={apiKey}
        onChange={setApiKey}
        placeholder={keyRequired ? "API-Key eingeben" : undefined}
        hint={
          envFallbackOnly && !apiKeyConfigured
            ? "Aktuell läuft WAHA nur über .env (WAHA_API_KEY). Einmal hier eintragen und speichern, damit der Key in der Plattform liegt und oben als hinterlegt erscheint."
            : apiKeyConfigured
              ? "Punkte = gespeicherter Key. Feld anklicken zum Ersetzen. Auge zeigt nur neu eingegebenen Text."
              : undefined
        }
      />
    </SuperadminIntegrationPanel>
  );
}
