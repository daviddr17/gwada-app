"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import {
  SmtpConnectionFields,
  type SmtpConnectionFieldValues,
} from "@/components/integrations/smtp-connection-fields";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  SettingsIntegrationPanel,
  integrationStatusBadgeConnected,
  integrationStatusBadgeDestructive,
  integrationStatusBadgeSecondary,
} from "@/components/settings/settings-integration-panel";
import { GWADA_DEFAULT_FROM_EMAIL } from "@/lib/constants/gwada-email-defaults";
import { useRegisterSettingsIntegrationSave } from "@/components/settings/settings-integration-save-registry";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { EmailIntegrationResponse } from "@/lib/types/restaurant-integration";

function fieldsSnapshot(
  useCustom: boolean,
  fields: SmtpConnectionFieldValues,
): string {
  return JSON.stringify({
    useCustom,
    email: fields.email.trim(),
    smtpHost: fields.smtpHost.trim(),
    smtpPort: fields.smtpPort.trim(),
    imapHost: fields.imapHost.trim(),
    imapPort: fields.imapPort.trim(),
    fromName: fields.fromName.trim(),
  });
}

export function EmailIntegrationCard({ onSaved }: { onSaved?: () => void }) {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permLoading } = useRestaurantPermissions();
  const canManage = has("integrations.email");
  const [state, setState] = useState<EmailIntegrationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [useCustom, setUseCustom] = useState(false);
  const [fields, setFields] = useState<SmtpConnectionFieldValues>({
    email: "",
    password: "",
    smtpHost: "",
    smtpPort: "",
    imapHost: "",
    imapPort: "",
    fromName: "",
  });
  const savedSnapshotRef = useRef("");

  const applyResponse = (data: EmailIntegrationResponse) => {
    setState(data);
    setUseCustom(data.status === "custom");
    const nextFields: SmtpConnectionFieldValues = {
      email: data.fromEmail ?? "",
      password: "",
      smtpHost: data.smtpHost ?? "",
      smtpPort: data.smtpPort ?? "",
      imapHost: data.imapHost ?? "",
      imapPort: data.imapPort ?? "",
      fromName: data.fromName ?? "",
    };
    setFields(nextFields);
    savedSnapshotRef.current = fieldsSnapshot(
      data.status === "custom",
      nextFields,
    );
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
        `/api/integrations/email?${new URLSearchParams({ restaurantId })}`,
      );
      const data = (await res.json()) as EmailIntegrationResponse & {
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "E-Mail-Einstellungen konnten nicht geladen werden.");
        setLoading(false);
        return;
      }
      applyResponse(data);
    } catch {
      toast.error("Netzwerkfehler beim Laden der E-Mail-Integration.");
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    const current = fieldsSnapshot(useCustom, fields);
    return current !== savedSnapshotRef.current || fields.password.length > 0;
  }, [useCustom, fields]);

  const save = useCallback(async () => {
    if (!restaurantId) return;
    const res = await fetch("/api/integrations/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId,
        useCustom,
        email: fields.email,
        password: fields.password,
        smtpHost: fields.smtpHost,
        smtpPort: fields.smtpPort,
        imapHost: fields.imapHost,
        imapPort: fields.imapPort,
        fromName: fields.fromName,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "Speichern fehlgeschlagen.");
      return;
    }
    toast.success("E-Mail-Verbindung gespeichert.");
    await load();
    onSaved?.();
  }, [restaurantId, useCustom, fields, load, onSaved]);

  useRegisterSettingsIntegrationSave("email", dirty && canManage, save);

  const sendTest = async () => {
    if (!restaurantId) return;
    setTesting(true);
    try {
      const res = await fetch("/api/integrations/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Test-E-Mail fehlgeschlagen.");
        setTesting(false);
        return;
      }
      toast.success("Test-E-Mail wurde an deine Anmelde-Adresse gesendet.");
    } catch {
      toast.error("Test-E-Mail fehlgeschlagen.");
    }
    setTesting(false);
  };

  const sendReady = state?.emailSendConfigured ?? false;
  const currentLabel = useCustom
    ? fields.email.trim() || "eigene Verbindung"
    : GWADA_DEFAULT_FROM_EMAIL;

  const badge = !sendReady
    ? integrationStatusBadgeDestructive("Noch nicht verfügbar")
    : useCustom
      ? integrationStatusBadgeConnected("Eigene Verbindung")
      : integrationStatusBadgeSecondary("Gwada-Standard");

  return (
    <SettingsIntegrationPanel
      title="E-Mail"
      description="Versendet und empfangt E-Mails direkt in Gwada – mit dem Gwada-Standard-Absender oder eurem eigenen Postfach (SMTP/IMAP)."
      icon={<Mail className="text-muted-foreground" />}
      badge={badge}
      summaryLine={
        <>
          Absender:{" "}
          <span className="font-mono text-foreground">{currentLabel}</span>
        </>
      }
      loading={permLoading || !workspaceReady || loading}
      denied={!canManage}
      deniedMessage="Keine Berechtigung — bitte Inhaber oder Manager um Freischaltung."
      noRestaurant={workspaceReady && !restaurantId}
      noRestaurantMessage="Wähle zuerst ein Restaurant im Workspace, um E-Mail einzurichten."
    >
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
        <div>
          <p className="text-sm font-medium">Eigene SMTP-Verbindung</p>
          <p className="text-xs text-muted-foreground">
            Statt des Gwada-Standard-Absenders
          </p>
        </div>
        <Switch
          checked={useCustom}
          disabled={!sendReady}
          onCheckedChange={(v) => setUseCustom(v === true)}
        />
      </div>

      {useCustom ? (
        <SmtpConnectionFields
          idPrefix="restaurant-email"
          values={fields}
          disabled={!sendReady}
          passwordConfigured={state?.passwordConfigured}
          onChange={(patch) => setFields((f) => ({ ...f, ...patch }))}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Standard-Absender:{" "}
          <span className="font-mono text-foreground">
            {GWADA_DEFAULT_FROM_EMAIL}
          </span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-11 rounded-xl"
          disabled={!sendReady || testing}
          onClick={() => void sendTest()}
        >
          Test-E-Mail senden
        </Button>
      </div>
      {dirty ? (
        <p className="text-xs text-muted-foreground">
          Ungespeicherte Änderungen — unten auf „Speichern“ klicken.
        </p>
      ) : null}
    </SettingsIntegrationPanel>
  );
}
