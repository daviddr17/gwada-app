"use client";

import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  SuperadminIntegrationPanel,
} from "@/components/superadmin/superadmin-integration-panel";
import { SuperadminIntegrationStatusBadges } from "@/components/superadmin/superadmin-integration-status-badges";
import { SecretInput } from "@/components/ui/secret-input";
import { Switch } from "@/components/ui/switch";
import type { PlatformMollieConfigUi } from "@/lib/integrations/platform-mollie-config";
import { useRegisterSuperadminIntegrationSave } from "@/lib/superadmin/integrations-save-registry";
import { saveSuperadminPlatformIntegration } from "@/lib/superadmin/platform-integrations-api";
import type { PlatformIntegrationRow } from "@/lib/types/platform-integration";
import type { SuperadminIntegrationConnectionHealth } from "@/lib/types/superadmin-ops-status";
import { INTEGRATION_PANEL_ACCENT } from "@/lib/ui/integration-panel-accent";

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

  const snapshot = useMemo(
    () => JSON.stringify({ enabled: row.enabled }),
    [row.enabled],
  );

  const dirty = useMemo(() => {
    return (
      JSON.stringify({ enabled }) !== snapshot ||
      clientId.trim().length > 0 ||
      clientSecret.trim().length > 0
    );
  }, [clientId, clientSecret, enabled, snapshot]);

  const save = async () => {
    const config: Record<string, unknown> = {};
    if (clientId.trim()) config.client_id = clientId.trim();
    if (clientSecret.trim()) config.client_secret = clientSecret.trim();
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
    onSaved();
  };

  useRegisterSuperadminIntegrationSave("mollie", dirty, save);

  const configured = Boolean(
    ui.client_id_configured && ui.client_secret_configured,
  );

  return (
    <SuperadminIntegrationPanel
      title="Mollie Connect"
      description="Gwada ist die Plattform-App. Jedes Restaurant verbindet danach sein eigenes Mollie-Konto. Redirect: /api/integrations/mollie/callback. Client-ID und Secret nur hier."
      icon={<Wallet className="size-5" />}
      accentColor={INTEGRATION_PANEL_ACCENT.mollie}
      badges={
        <SuperadminIntegrationStatusBadges
          enabled={enabled}
          configured={configured}
          configuredLabel="Client hinterlegt"
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
        Nach dem Speichern siehst du die Werte nicht wieder, nur ob sie
        hinterlegt sind. Gastzahlungen laufen hier noch nicht.
      </p>
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
    </SuperadminIntegrationPanel>
  );
}
