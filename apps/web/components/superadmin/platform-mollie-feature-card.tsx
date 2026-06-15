"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import {
  SuperadminIntegrationPanel,
  superadminIntegrationFieldLabelClassName,
  superadminIntegrationInputClassName,
} from "@/components/superadmin/superadmin-integration-panel";
import { INTEGRATION_PANEL_ACCENT } from "@/lib/ui/integration-panel-accent";
import { SuperadminIntegrationStatusBadges } from "@/components/superadmin/superadmin-integration-status-badges";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SecretInput } from "@/components/ui/secret-input";
import { Switch } from "@/components/ui/switch";
import { useRegisterSuperadminIntegrationSave } from "@/lib/superadmin/integrations-save-registry";
import { saveSuperadminPlatformIntegration } from "@/lib/superadmin/platform-integrations-api";
import type { PlatformMollieConfigUi } from "@/lib/integrations/platform-mollie-config";
import type { PlatformIntegrationRow } from "@/lib/types/platform-integration";

export function PlatformMollieFeatureCard({
  row,
  onSaved,
}: {
  row: PlatformIntegrationRow;
  onSaved: () => void;
}) {
  const ui = row.config as PlatformMollieConfigUi;
  const [enabled, setEnabled] = useState(row.enabled);
  const [clientId, setClientId] = useState(ui.client_id ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [profileId, setProfileId] = useState(ui.profile_id ?? "");
  const [webhookSecret, setWebhookSecret] = useState("");

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        enabled: row.enabled,
        client_id: ui.client_id ?? "",
        profile_id: ui.profile_id ?? "",
      }),
    [row.enabled, ui.client_id, ui.profile_id],
  );

  const dirty = useMemo(() => {
    const current = JSON.stringify({
      enabled,
      client_id: clientId,
      profile_id: profileId,
    });
    return (
      current !== snapshot ||
      clientSecret.trim().length > 0 ||
      apiKey.trim().length > 0 ||
      webhookSecret.trim().length > 0
    );
  }, [
    enabled,
    clientId,
    profileId,
    snapshot,
    clientSecret,
    apiKey,
    webhookSecret,
  ]);

  useEffect(() => {
    setEnabled(row.enabled);
    setClientId(ui.client_id ?? "");
    setProfileId(ui.profile_id ?? "");
    setClientSecret("");
    setApiKey("");
    setWebhookSecret("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot
  }, [snapshot]);

  const configured =
    Boolean(ui.client_id && ui.client_secret_configured) ||
    Boolean(ui.api_key_configured);

  const save = async () => {
    const { ok, error } = await saveSuperadminPlatformIntegration(
      "mollie",
      enabled,
      {
        client_id: clientId.trim() || undefined,
        client_secret: clientSecret.trim() || undefined,
        api_key: apiKey.trim() || undefined,
        profile_id: profileId.trim() || undefined,
        webhook_secret: webhookSecret.trim() || undefined,
      },
    );
    if (!ok) {
      toast.error(error ?? "Speichern fehlgeschlagen.");
      return;
    }
    toast.success("Mollie gespeichert.");
    onSaved();
  };

  useRegisterSuperadminIntegrationSave("mollie", dirty, save);

  return (
    <SuperadminIntegrationPanel
      title="Mollie"
      description="Kartenzahlung und PayPal für Staff-POS. OAuth pro Restaurant (empfohlen) oder Plattform-API-Key als Fallback. Webhook: https://new.gwada.app/api/pos/mollie/webhook"
      icon={<CreditCard className="size-5" />}
      accentColor={INTEGRATION_PANEL_ACCENT.mollie}
      badges={
        <SuperadminIntegrationStatusBadges
          enabled={enabled}
          configured={configured}
          configuredLabel="OAuth oder API-Key hinterlegt"
        />
      }
      headerTrailing={
        <Switch
          checked={enabled}
          onCheckedChange={(v) => setEnabled(v === true)}
          aria-label="Mollie aktivieren"
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label className={superadminIntegrationFieldLabelClassName}>
            OAuth Client ID
          </Label>
          <Input
            className={superadminIntegrationInputClassName}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="app_…"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label className={superadminIntegrationFieldLabelClassName}>
            OAuth Client Secret
          </Label>
          <SecretInput
            configured={Boolean(ui.client_secret_configured)}
            value={clientSecret}
            onChange={setClientSecret}
            placeholder="Neues Secret eingeben"
          />
        </div>
        <div className="space-y-2">
          <Label className={superadminIntegrationFieldLabelClassName}>
            Profil-ID (optional)
          </Label>
          <Input
            className={superadminIntegrationInputClassName}
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            placeholder="pfl_…"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label className={superadminIntegrationFieldLabelClassName}>
            Plattform-API-Key (Fallback)
          </Label>
          <SecretInput
            configured={Boolean(ui.api_key_configured)}
            value={apiKey}
            onChange={setApiKey}
            placeholder="live_… oder test_…"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label className={superadminIntegrationFieldLabelClassName}>
            Webhook-Secret (optional)
          </Label>
          <SecretInput
            configured={Boolean(ui.webhook_secret_configured)}
            value={webhookSecret}
            onChange={setWebhookSecret}
            placeholder="Signaturprüfung"
          />
        </div>
      </div>
    </SuperadminIntegrationPanel>
  );
}
