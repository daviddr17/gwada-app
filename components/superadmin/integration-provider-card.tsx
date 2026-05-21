"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import type {
  PlatformIntegrationConfig,
  PlatformIntegrationRow,
} from "@/lib/types/platform-integration";
import { upsertPlatformIntegration } from "@/lib/supabase/platform-superadmin-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

export function IntegrationProviderCard({
  title,
  description,
  icon,
  row,
  configurable,
  onSaved,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  row: PlatformIntegrationRow;
  configurable: boolean;
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(row.enabled);
  const [clientId, setClientId] = useState(row.config.client_id ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setEnabled(row.enabled);
    setClientId(row.config.client_id ?? "");
    setClientSecret("");
    setDirty(false);
  }, [row]);

  const markDirty = () => setDirty(true);

  const buildConfig = (): PlatformIntegrationConfig => {
    const config: PlatformIntegrationConfig = {
      client_id: clientId.trim() || undefined,
    };
    const secret = clientSecret.trim();
    if (secret) {
      config.client_secret = secret;
    } else if (row.config.client_secret) {
      config.client_secret = row.config.client_secret;
    }
    return config;
  };

  const save = async () => {
    setSaving(true);
    try {
      const sb = createSupabaseBrowserClient();
      const { error } = await upsertPlatformIntegration(
        sb,
        row.key,
        enabled,
        buildConfig(),
      );
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(`${title} gespeichert.`);
      setClientSecret("");
      setDirty(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-background">
          {icon}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">{title}</CardTitle>
            {!configurable ? (
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
            )}
          </div>
          <CardDescription>{description}</CardDescription>
        </div>
        <Switch
          checked={enabled}
          disabled={!configurable}
          onCheckedChange={(v) => {
            setEnabled(v);
            markDirty();
          }}
          aria-label={`${title} aktivieren`}
        />
      </CardHeader>
      {configurable ? (
        <CardContent className="space-y-4 border-t border-border/40 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${row.key}-client-id`}>Client ID</Label>
              <Input
                id={`${row.key}-client-id`}
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  markDirty();
                }}
                placeholder="OAuth Client ID"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${row.key}-client-secret`}>
                Client Secret / Token
              </Label>
              <Input
                id={`${row.key}-client-secret`}
                type="password"
                value={clientSecret}
                onChange={(e) => {
                  setClientSecret(e.target.value);
                  markDirty();
                }}
                placeholder={
                  row.config.client_secret
                    ? "••••••••  (leer lassen = unverändert)"
                    : "Secret eingeben"
                }
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={!dirty || saving}
              className={cn(settingsAccentSaveButtonClassName)}
              onClick={() => void save()}
            >
              {saving ? "Speichern…" : "Speichern"}
            </Button>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
