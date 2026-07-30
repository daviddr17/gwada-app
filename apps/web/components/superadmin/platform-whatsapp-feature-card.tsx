"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import {
  SuperadminIntegrationPanel,
  superadminIntegrationFieldLabelClassName,
  superadminIntegrationInputClassName,
} from "@/components/superadmin/superadmin-integration-panel";
import { INTEGRATION_PANEL_ACCENT } from "@/lib/ui/integration-panel-accent";
import {
  SuperadminIntegrationStatusBadges,
} from "@/components/superadmin/superadmin-integration-status-badges";
import { SecretInput } from "@/components/ui/secret-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useRegisterSuperadminIntegrationSave } from "@/lib/superadmin/integrations-save-registry";
import { saveSuperadminPlatformIntegration } from "@/lib/superadmin/platform-integrations-api";
import type { PlatformIntegrationRow } from "@/lib/types/platform-integration";
import type { SuperadminIntegrationConnectionHealth } from "@/lib/types/superadmin-ops-status";

type WhatsappUiConfig = {
  waha_base_url?: string;
  waha_api_key_configured?: boolean;
};

export function PlatformWhatsappFeatureCard({
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
  const ui = row.config as WhatsappUiConfig;
  const [enabled, setEnabled] = useState(row.enabled);
  const [baseUrl, setBaseUrl] = useState(ui.waha_base_url ?? "");
  const [apiKey, setApiKey] = useState("");
  const apiKeyConfigured = Boolean(ui.waha_api_key_configured);

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
    if (enabled && !apiKeyConfigured && !apiKey.trim()) {
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

  const keyRequired = enabled && !apiKeyConfigured;

  return (
    <SuperadminIntegrationPanel
      title="WhatsApp"
      description={
        <>
          Feature-Freischaltung für Restaurants. Server-Pool, Sessions und
          Kapazität verwalten unter{" "}
          <Link
            href="/superadmin/waha"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            Superadmin → WAHA
          </Link>
          . URL/Key hier synchronisieren den Primär-Server (Legacy).
        </>
      }
      icon={<WhatsAppGlyph />}
      accentColor={INTEGRATION_PANEL_ACCENT.whatsapp}
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
          aria-label="WhatsApp aktivieren"
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
          apiKeyConfigured
            ? "Punkte = gespeicherter Key. Feld anklicken zum Ersetzen. Auge zeigt nur neu eingegebenen Text."
            : undefined
        }
      />
    </SuperadminIntegrationPanel>
  );
}
