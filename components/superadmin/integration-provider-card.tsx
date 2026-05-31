"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { SecretInput } from "@/components/ui/secret-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  SuperadminIntegrationPanel,
  superadminIntegrationFieldLabelClassName,
  superadminIntegrationInputClassName,
} from "@/components/superadmin/superadmin-integration-panel";
import { useRegisterSuperadminIntegrationSave } from "@/lib/superadmin/integrations-save-registry";
import { saveSuperadminPlatformIntegration } from "@/lib/superadmin/platform-integrations-api";
import type {
  PlatformIntegrationKey,
  PlatformIntegrationRow,
} from "@/lib/types/platform-integration";

export function IntegrationProviderCard({
  title,
  description,
  icon,
  row,
  configurable,
  clientIdLabel = "Client ID",
  clientSecretLabel = "Client Secret / Token",
  clientIdPlaceholder = "OAuth Client ID",
  onSaved,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  row: PlatformIntegrationRow;
  configurable: boolean;
  clientIdLabel?: string;
  clientSecretLabel?: string;
  clientIdPlaceholder?: string;
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(row.enabled);
  const [clientId, setClientId] = useState(
    (row.config.client_id as string | undefined) ?? "",
  );
  const [clientSecret, setClientSecret] = useState("");
  const secretConfigured = Boolean(row.config.client_secret_configured);

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        enabled: row.enabled,
        clientId: (row.config.client_id as string | undefined) ?? "",
      }),
    [row],
  );

  const dirty = useMemo(() => {
    const current = JSON.stringify({
      enabled,
      clientId: clientId.trim(),
    });
    return current !== snapshot || clientSecret.length > 0;
  }, [enabled, clientId, clientSecret, snapshot]);

  useEffect(() => {
    setEnabled(row.enabled);
    setClientId((row.config.client_id as string | undefined) ?? "");
    setClientSecret("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot statt `row`-Referenz
  }, [snapshot]);

  const save = async () => {
    const config: Record<string, unknown> = {
      client_id: clientId.trim() || undefined,
    };
    if (clientSecret.trim()) {
      config.client_secret = clientSecret.trim();
    }

    const { ok, error } = await saveSuperadminPlatformIntegration(
      row.key as PlatformIntegrationKey,
      enabled,
      config,
    );
    if (!ok) {
      toast.error(error ?? "Speichern fehlgeschlagen.");
      return;
    }
    toast.success(`${title} gespeichert.`);
    setClientSecret("");
    onSaved();
  };

  useRegisterSuperadminIntegrationSave(row.key, dirty && configurable, save);

  const statusBadge = !configurable ? (
    <Badge variant="outline" className="text-[0.625rem] uppercase">
      Demnächst
    </Badge>
  ) : enabled ? (
    <Badge
      variant="outline"
      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
    >
      Aktiv
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Inaktiv
    </Badge>
  );

  return (
    <SuperadminIntegrationPanel
      title={title}
      description={description}
      icon={icon}
      badges={statusBadge}
      headerTrailing={
        <Switch
          checked={enabled}
          disabled={!configurable}
          onCheckedChange={(v) => setEnabled(v === true)}
          aria-label={`${title} aktivieren`}
        />
      }
    >
      {configurable ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label
              htmlFor={`${row.key}-client-id`}
              className={superadminIntegrationFieldLabelClassName}
            >
              {clientIdLabel}
            </Label>
            <Input
              id={`${row.key}-client-id`}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={clientIdPlaceholder}
              autoComplete="off"
              className={superadminIntegrationInputClassName}
              spellCheck={false}
            />
          </div>
          <SecretInput
            id={`${row.key}-client-secret`}
            label={clientSecretLabel}
            configured={secretConfigured}
            value={clientSecret}
            onChange={setClientSecret}
            placeholder={secretConfigured ? undefined : "Secret eingeben"}
          />
        </div>
      ) : null}
    </SuperadminIntegrationPanel>
  );
}
