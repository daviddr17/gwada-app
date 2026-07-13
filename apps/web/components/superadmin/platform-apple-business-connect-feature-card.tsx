"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppleGlyph } from "@/components/icons/apple-glyph";
import { SuperadminIntegrationPanel } from "@/components/superadmin/superadmin-integration-panel";
import { INTEGRATION_PANEL_ACCENT } from "@/lib/ui/integration-panel-accent";
import { SuperadminIntegrationStatusBadges } from "@/components/superadmin/superadmin-integration-status-badges";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SecretInput } from "@/components/ui/secret-input";
import { Switch } from "@/components/ui/switch";
import { useRegisterSuperadminIntegrationSave } from "@/lib/superadmin/integrations-save-registry";
import { saveSuperadminPlatformIntegration } from "@/lib/superadmin/platform-integrations-api";
import type { PlatformIntegrationRow } from "@/lib/types/platform-integration";
import type { SuperadminIntegrationConnectionHealth } from "@/lib/types/superadmin-ops-status";

type AppleBcUiConfig = {
  issuer_id?: string;
  key_id?: string;
  private_key_configured?: boolean;
};

export function PlatformAppleBusinessConnectFeatureCard({
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
  const ui = row.config as AppleBcUiConfig;
  const [enabled, setEnabled] = useState(row.enabled);
  const [issuerId, setIssuerId] = useState(ui.issuer_id ?? "");
  const [keyId, setKeyId] = useState(ui.key_id ?? "");
  const [privateKey, setPrivateKey] = useState("");
  const privateKeyConfigured = Boolean(ui.private_key_configured);

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        enabled: row.enabled,
        issuer_id: ui.issuer_id ?? "",
        key_id: ui.key_id ?? "",
      }),
    [row.enabled, ui.issuer_id, ui.key_id],
  );

  const dirty = useMemo(() => {
    const current = JSON.stringify({
      enabled,
      issuer_id: issuerId.trim(),
      key_id: keyId.trim(),
    });
    return current !== snapshot || privateKey.length > 0;
  }, [enabled, issuerId, keyId, privateKey, snapshot]);

  useEffect(() => {
    setEnabled(row.enabled);
    setIssuerId(ui.issuer_id ?? "");
    setKeyId(ui.key_id ?? "");
    setPrivateKey("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot
  }, [snapshot]);

  const save = async () => {
    if (enabled) {
      if (!issuerId.trim() || !keyId.trim()) {
        toast.error("Issuer-ID und Key-ID erforderlich.");
        return;
      }
      if (!privateKeyConfigured && !privateKey.trim()) {
        toast.error("Private Key (PEM) erforderlich.");
        return;
      }
    }

    const config: Record<string, unknown> = {
      issuer_id: issuerId.trim() || undefined,
      key_id: keyId.trim() || undefined,
    };
    if (privateKey.trim()) {
      config.private_key = privateKey.trim();
    }

    const { ok, error } = await saveSuperadminPlatformIntegration(
      "apple_business_connect",
      enabled,
      config,
    );
    if (!ok) {
      toast.error(error ?? "Speichern fehlgeschlagen.");
      return;
    }
    toast.success("Apple Business Connect gespeichert.");
    setPrivateKey("");
    onSaved();
  };

  useRegisterSuperadminIntegrationSave("apple_business_connect", dirty, save);

  const configured =
    Boolean(issuerId.trim() || ui.issuer_id) &&
    Boolean(keyId.trim() || ui.key_id) &&
    (privateKeyConfigured || privateKey.trim().length > 0);

  return (
    <SuperadminIntegrationPanel
      title="Apple Business Connect"
      description="API-Zugang für Standort-Sync in Apple Maps (Issuer-ID, Key-ID, Private Key aus dem Apple Developer Portal). Restaurants hinterlegen ihre Location-ID unter Einstellungen → Integrationen."
      icon={<AppleGlyph className="size-5 text-foreground" aria-hidden />}
      accentColor={INTEGRATION_PANEL_ACCENT.apple_business_connect}
      badges={
        <SuperadminIntegrationStatusBadges
          enabled={enabled}
          configured={configured}
          configuredLabel="API-Zugang hinterlegt"
          connection={connection}
          connectionChecking={connectionChecking}
        />
      }
      headerTrailing={
        <Switch
          checked={enabled}
          onCheckedChange={(v) => setEnabled(v === true)}
          aria-label="Apple Business Connect aktivieren"
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="platform-apple-bc-issuer" className="text-xs text-muted-foreground">
            Issuer-ID
          </Label>
          <Input
            id="platform-apple-bc-issuer"
            disabled={!enabled}
            value={issuerId}
            onChange={(e) => setIssuerId(e.target.value)}
            placeholder="z. B. 69a6de…"
            className="h-10 rounded-xl font-mono text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="platform-apple-bc-key-id" className="text-xs text-muted-foreground">
            Key-ID
          </Label>
          <Input
            id="platform-apple-bc-key-id"
            disabled={!enabled}
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            placeholder="z. B. 2X9RQT…"
            className="h-10 rounded-xl font-mono text-sm"
          />
        </div>
      </div>
      <SecretInput
        id="platform-apple-bc-private-key"
        label="Private Key (PEM)"
        disabled={!enabled}
        configured={privateKeyConfigured}
        value={privateKey}
        onChange={setPrivateKey}
        placeholder={
          enabled && !privateKeyConfigured ? ".p8-Inhalt als PEM" : undefined
        }
        hint={
          privateKeyConfigured
            ? "Punkte = gespeicherter Key. Feld anklicken zum Ersetzen."
            : "Aus dem Apple Developer Portal — Business Connect API."
        }
      />
    </SuperadminIntegrationPanel>
  );
}
