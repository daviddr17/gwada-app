"use client";

import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  SuperadminIntegrationPanel,
} from "@/components/superadmin/superadmin-integration-panel";
import { SuperadminIntegrationStatusBadges } from "@/components/superadmin/superadmin-integration-status-badges";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SecretInput } from "@/components/ui/secret-input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PlatformMollieConfigUi } from "@/lib/integrations/platform-mollie-config";
import { useRegisterSuperadminIntegrationSave } from "@/lib/superadmin/integrations-save-registry";
import { saveSuperadminPlatformIntegration } from "@/lib/superadmin/platform-integrations-api";
import type { PlatformIntegrationRow } from "@/lib/types/platform-integration";
import type { SuperadminIntegrationConnectionHealth } from "@/lib/types/superadmin-ops-status";
import { INTEGRATION_PANEL_ACCENT } from "@/lib/ui/integration-panel-accent";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

export function PlatformMollieFeatureCard({
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
  const ui = row.config as PlatformMollieConfigUi;
  const [enabled, setEnabled] = useState(row.enabled);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [profileId, setProfileId] = useState(ui.profile_id ?? "");
  const [mode, setMode] = useState<"test" | "live">(ui.mode ?? "test");
  const [applicationFeeEur, setApplicationFeeEur] = useState(
    ui.application_fee_eur ?? "",
  );

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        enabled: row.enabled,
        profile_id: ui.profile_id ?? "",
        mode: ui.mode ?? "test",
        application_fee_eur: ui.application_fee_eur ?? "",
      }),
    [row.enabled, ui.application_fee_eur, ui.mode, ui.profile_id],
  );

  const dirty = useMemo(() => {
    return (
      JSON.stringify({
        enabled,
        profile_id: profileId.trim(),
        mode,
        application_fee_eur: applicationFeeEur.trim(),
      }) !== snapshot ||
      clientId.trim().length > 0 ||
      clientSecret.trim().length > 0 ||
      apiKey.trim().length > 0
    );
  }, [
    apiKey,
    applicationFeeEur,
    clientId,
    clientSecret,
    enabled,
    mode,
    profileId,
    snapshot,
  ]);

  const save = async () => {
    const config: Record<string, unknown> = {
      mode,
      profile_id: profileId.trim(),
      application_fee_eur: applicationFeeEur.trim(),
    };
    if (clientId.trim()) config.client_id = clientId.trim();
    if (clientSecret.trim()) config.client_secret = clientSecret.trim();
    if (apiKey.trim()) config.api_key = apiKey.trim();
    const { ok, error } = await saveSuperadminPlatformIntegration(
      "mollie",
      enabled,
      config,
    );
    if (!ok) {
      toast.error(error ?? "Speichern fehlgeschlagen.");
      return;
    }
    toast.success("Mollie gespeichert.");
    setClientId("");
    setClientSecret("");
    setApiKey("");
    onSaved();
  };

  useRegisterSuperadminIntegrationSave("mollie", dirty, save);

  const configured = Boolean(
    ui.client_id_configured &&
      ui.client_secret_configured &&
      ui.api_key_configured,
  );

  return (
    <SuperadminIntegrationPanel
      title="Mollie"
      description="Ein Anbieter für alles: Connect (Gast→Restaurant + POS) und Gwada-API-Key (Software-Abos). Secrets nur hier."
      icon={<Wallet className="size-5" />}
      accentColor={INTEGRATION_PANEL_ACCENT.mollie}
      badges={
        <SuperadminIntegrationStatusBadges
          enabled={enabled}
          configured={configured}
          configuredLabel="Connect + Billing hinterlegt"
          connection={connection}
          connectionChecking={connectionChecking}
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
      <p className="text-sm text-muted-foreground">
        OAuth-App: Redirect{" "}
        <code className="text-xs">/api/integrations/mollie/callback</code>.
        Billing-Webhook:{" "}
        <code className="text-xs">/api/billing/mollie/webhook</code>. Nach dem
        Speichern siehst du Secrets nicht wieder.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="platform-mollie-mode">Modus</Label>
          <Select
            value={mode}
            onValueChange={(v) => setMode(v === "live" ? "live" : "test")}
          >
            <SelectTrigger
              id="platform-mollie-mode"
              className={appSelectTriggerAccentCn("h-9 w-full")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="test">Test</SelectItem>
              <SelectItem value="live">Live</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="platform-mollie-fee">
            Application Fee (EUR, optional)
          </Label>
          <Input
            id="platform-mollie-fee"
            inputMode="decimal"
            placeholder="0.00"
            value={applicationFeeEur}
            onChange={(e) => setApplicationFeeEur(e.target.value)}
          />
        </div>
      </div>

      <p className="text-sm font-medium">Connect (Restaurants)</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <SecretInput
          id="platform-mollie-client-id"
          label="Client ID"
          configured={Boolean(ui.client_id_configured)}
          value={clientId}
          onChange={setClientId}
          placeholder="Client ID"
        />
        <SecretInput
          id="platform-mollie-client-secret"
          label="Client Secret"
          configured={Boolean(ui.client_secret_configured)}
          value={clientSecret}
          onChange={setClientSecret}
          placeholder="Client Secret"
        />
      </div>

      <p className="text-sm font-medium">Gwada-Billing (Restaurant → Gwada)</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <SecretInput
          id="platform-mollie-api-key"
          label="API-Key (test_ / live_)"
          configured={Boolean(ui.api_key_configured)}
          value={apiKey}
          onChange={setApiKey}
          placeholder="test_…"
        />
        <div className="space-y-2">
          <Label htmlFor="platform-mollie-profile">Profil-ID (optional)</Label>
          <Input
            id="platform-mollie-profile"
            placeholder="pfl_…"
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
          />
        </div>
      </div>
    </SuperadminIntegrationPanel>
  );
}
