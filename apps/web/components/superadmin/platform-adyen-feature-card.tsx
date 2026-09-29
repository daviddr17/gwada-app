"use client";

import { useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { toast } from "sonner";
import {
  SuperadminIntegrationPanel,
  superadminIntegrationFieldLabelClassName,
} from "@/components/superadmin/superadmin-integration-panel";
import { SuperadminIntegrationStatusBadges } from "@/components/superadmin/superadmin-integration-status-badges";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SecretInput } from "@/components/ui/secret-input";
import { Switch } from "@/components/ui/switch";
import type { PlatformAdyenConfigUi } from "@/lib/integrations/platform-adyen-config";
import { useRegisterSuperadminIntegrationSave } from "@/lib/superadmin/integrations-save-registry";
import { saveSuperadminPlatformIntegration } from "@/lib/superadmin/platform-integrations-api";
import type { PlatformIntegrationRow } from "@/lib/types/platform-integration";
import type { SuperadminIntegrationConnectionHealth } from "@/lib/types/superadmin-ops-status";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { INTEGRATION_PANEL_ACCENT } from "@/lib/ui/integration-panel-accent";

export function PlatformAdyenFeatureCard({
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
  const ui = row.config as PlatformAdyenConfigUi;
  const [enabled, setEnabled] = useState(row.enabled);
  const [env, setEnv] = useState<"test" | "live">(ui.env === "live" ? "live" : "test");
  const [lemKey, setLemKey] = useState("");
  const [balanceKey, setBalanceKey] = useState("");

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        enabled: row.enabled,
        env: ui.env === "live" ? "live" : "test",
      }),
    [row.enabled, ui.env],
  );

  const dirty = useMemo(() => {
    const current = JSON.stringify({ enabled, env });
    return current !== snapshot || lemKey.trim().length > 0 || balanceKey.trim().length > 0;
  }, [balanceKey, enabled, env, lemKey, snapshot]);

  const save = async () => {
    const config: Record<string, unknown> = { env };
    if (lemKey.trim()) config.lem_api_key = lemKey.trim();
    if (balanceKey.trim()) config.balance_platform_api_key = balanceKey.trim();
    const { ok, error } = await saveSuperadminPlatformIntegration(
      "adyen",
      enabled,
      config,
    );
    if (!ok) {
      toast.error(error ?? "Speichern fehlgeschlagen.");
      return;
    }
    toast.success("Adyen gespeichert.");
    setLemKey("");
    setBalanceKey("");
    onSaved();
  };

  useRegisterSuperadminIntegrationSave("adyen", dirty, save);

  const configured = Boolean(
    ui.lem_api_key_configured && ui.balance_platform_api_key_configured,
  );

  return (
    <SuperadminIntegrationPanel
      title="Adyen for Platforms"
      description="Gehostetes Onboarding: das Restaurant legt sein Konto bei Adyen an. Keys nur hier. Kein OAuth-Nachbau."
      icon={<Landmark className="size-5" />}
      accentColor={INTEGRATION_PANEL_ACCENT.adyen}
      badges={
        <SuperadminIntegrationStatusBadges
          enabled={enabled}
          configured={configured}
          configuredLabel="Keys hinterlegt"
          connection={connection}
          connectionChecking={connectionChecking}
        />
      }
      headerTrailing={
        <Switch
          checked={enabled}
          onCheckedChange={(v) => setEnabled(v === true)}
          aria-label="Adyen aktivieren"
        />
      }
    >
      <p className="text-sm text-muted-foreground">
        Legal Entity Management und Balance Platform, jeweils ein API-Key.
        Die Weiterleitung kommt von Adyen. Gastzahlungen laufen hier noch nicht.
      </p>
      <div className="space-y-1.5">
        <Label className={superadminIntegrationFieldLabelClassName}>Umgebung</Label>
        <Select value={env} onValueChange={(v) => setEnv(v === "live" ? "live" : "test")}>
          <SelectTrigger className={appSelectTriggerAccentCn("h-9 w-full max-w-xs")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="test">Test</SelectItem>
            <SelectItem value="live">Live</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <SecretInput
        id="platform-adyen-lem-key"
        label="Legal Entity Management API-Key"
        configured={Boolean(ui.lem_api_key_configured)}
        value={lemKey}
        onChange={setLemKey}
        placeholder="LEM API-Key"
      />
      <SecretInput
        id="platform-adyen-balance-key"
        label="Balance Platform API-Key"
        configured={Boolean(ui.balance_platform_api_key_configured)}
        value={balanceKey}
        onChange={setBalanceKey}
        placeholder="Balance Platform API-Key"
      />
    </SuperadminIntegrationPanel>
  );
}
