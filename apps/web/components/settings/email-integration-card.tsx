"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import {
  SmtpConnectionFields,
  type SmtpConnectionFieldValues,
} from "@/components/integrations/smtp-connection-fields";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  SettingsIntegrationPanel,
  integrationStatusBadgeConnected,
  integrationStatusBadgeDestructive,
  integrationStatusBadgeSecondary,
} from "@/components/settings/settings-integration-panel";
import { IntegrationGrantedScopes } from "@/components/settings/integration-granted-scopes";
import { GWADA_DEFAULT_FROM_EMAIL } from "@/lib/constants/gwada-email-defaults";
import { useRegisterSettingsIntegrationSave } from "@/components/settings/settings-integration-save-registry";
import { invalidateInboxAfterChannelConnect } from "@/lib/contact-messages/invalidate-inbox-after-channel-connect-client";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import { INTEGRATION_PANEL_ACCENT } from "@/lib/ui/integration-panel-accent";
import type { EmailIntegrationResponse } from "@/lib/types/restaurant-integration";
import { cn } from "@/lib/utils";

type MailboxMode = "smtp" | "gmail";

function fieldsSnapshot(
  useCustom: boolean,
  mailboxMode: MailboxMode,
  fields: SmtpConnectionFieldValues,
): string {
  return JSON.stringify({
    useCustom,
    mailboxMode,
    email: fields.email.trim(),
    smtpHost: fields.smtpHost.trim(),
    smtpPort: fields.smtpPort.trim(),
    imapHost: fields.imapHost.trim(),
    imapPort: fields.imapPort.trim(),
    fromName: fields.fromName.trim(),
  });
}

export function EmailIntegrationCard({ onSaved }: { onSaved?: () => void }) {
  const searchParams = useSearchParams();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permLoading } = useRestaurantPermissions();
  const canManage = has("integrations.email");
  const [state, setState] = useState<EmailIntegrationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);
  const [useCustom, setUseCustom] = useState(false);
  const [mailboxMode, setMailboxMode] = useState<MailboxMode>("smtp");
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
  const oauthToastHandled = useRef(false);

  const applyResponse = (data: EmailIntegrationResponse) => {
    setState(data);
    const custom = data.status === "custom" || data.status === "gmail";
    setUseCustom(custom);
    setMailboxMode(data.status === "gmail" ? "gmail" : "smtp");
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
      custom,
      data.status === "gmail" ? "gmail" : "smtp",
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
        toast.error(
          data.error ?? "E-Mail-Einstellungen konnten nicht geladen werden.",
        );
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

  useEffect(() => {
    if (oauthToastHandled.current) return;
    const result = searchParams.get("email");
    if (!result) return;
    oauthToastHandled.current = true;
    if (result === "connected") {
      toast.success("Gmail verbunden.");
      if (restaurantId) invalidateInboxAfterChannelConnect(restaurantId);
      void load();
    } else if (result === "error") {
      toast.error(
        searchParams.get("message") ?? "Gmail-Verbindung fehlgeschlagen.",
      );
    }
  }, [searchParams, restaurantId, load]);

  const dirty = useMemo(() => {
    const current = fieldsSnapshot(useCustom, mailboxMode, fields);
    return current !== savedSnapshotRef.current || fields.password.length > 0;
  }, [useCustom, mailboxMode, fields]);

  const save = useCallback(async () => {
    if (!restaurantId) return;
    const wasMailbox =
      state?.status === "custom" || state?.status === "gmail";
    const res = await fetch("/api/integrations/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId,
        useCustom,
        mailboxMode: useCustom ? mailboxMode : undefined,
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
    if (useCustom && !wasMailbox) {
      invalidateInboxAfterChannelConnect(restaurantId);
    }
    onSaved?.();
  }, [
    restaurantId,
    useCustom,
    mailboxMode,
    fields,
    load,
    onSaved,
    state?.status,
  ]);

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

  const connectGmail = () => {
    if (!restaurantId) return;
    window.location.assign(
      `/api/integrations/email/gmail/connect?${new URLSearchParams({ restaurantId })}`,
    );
  };

  const disconnectGmail = async () => {
    if (!restaurantId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/email/gmail/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Trennen fehlgeschlagen.");
        throw new Error(data.error ?? "disconnect_failed");
      }
      toast.success("Gmail getrennt.");
      await load();
      onSaved?.();
    } catch (e) {
      if (!(e instanceof Error) || e.message === "disconnect_failed") {
        /* toast already shown */
      } else {
        toast.error("Trennen fehlgeschlagen.");
      }
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const sendReady = state?.emailSendConfigured ?? false;
  const gmailConnected = state?.status === "gmail";
  const currentLabel = !useCustom
    ? GWADA_DEFAULT_FROM_EMAIL
    : mailboxMode === "gmail"
      ? fields.email.trim() || "Gmail"
      : fields.email.trim() || "eigene Verbindung";

  const badge = !sendReady
    ? integrationStatusBadgeDestructive("Noch nicht verfügbar")
    : gmailConnected
      ? integrationStatusBadgeConnected("Gmail")
      : useCustom
        ? integrationStatusBadgeConnected("IMAP/SMTP")
        : integrationStatusBadgeSecondary("Gwada-Standard");

  return (
    <SettingsIntegrationPanel
      title="E-Mail"
      description="Versendet und empfängt E-Mails in Gwada – Gwada-Standard, eigenes IMAP/SMTP oder Gmail (OAuth)."
      icon={<Mail className="text-muted-foreground" />}
      accentColor={INTEGRATION_PANEL_ACCENT.email}
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
          <p className="text-sm font-medium">Eigenes Postfach</p>
          <p className="text-xs text-muted-foreground">
            Statt des Gwada-Standard-Absenders
          </p>
        </div>
        <Switch
          checked={useCustom}
          disabled={!sendReady}
          onCheckedChange={(v) => {
            const next = v === true;
            setUseCustom(next);
            if (!next) setMailboxMode("smtp");
          }}
        />
      </div>

      {useCustom ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mailboxMode === "smtp" ? "secondary" : "outline"}
              className="h-9 flex-1 rounded-xl"
              disabled={!sendReady}
              onClick={() => setMailboxMode("smtp")}
            >
              IMAP / SMTP
            </Button>
            <Button
              type="button"
              variant={mailboxMode === "gmail" ? "secondary" : "outline"}
              className="h-9 flex-1 rounded-xl"
              disabled={!sendReady}
              onClick={() => setMailboxMode("gmail")}
            >
              Gmail
            </Button>
          </div>

          {mailboxMode === "smtp" ? (
            <SmtpConnectionFields
              idPrefix="restaurant-email"
              values={fields}
              disabled={!sendReady}
              passwordConfigured={state?.passwordConfigured}
              onChange={(patch) => setFields((f) => ({ ...f, ...patch }))}
            />
          ) : (
            <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 px-3 py-3">
              {!state?.gmailOAuthConfigured ? (
                <p className="text-sm text-muted-foreground">
                  Gmail-OAuth ist noch nicht eingerichtet. Im Superadmin unter
                  Google OAuth Client-ID und Secret hinterlegen und die
                  Redirect-URI{" "}
                  <span className="font-mono text-xs">
                    /api/integrations/email/gmail/callback
                  </span>{" "}
                  in der Google Cloud Console freigeben.
                </p>
              ) : gmailConnected ? (
                <>
                  <p className="text-sm">
                    Verbunden als{" "}
                    <span className="font-mono font-medium">
                      {fields.email || "Gmail"}
                    </span>
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="restaurant-email-gmail-from-name">
                      Absendername
                    </Label>
                    <Input
                      id="restaurant-email-gmail-from-name"
                      value={fields.fromName}
                      onChange={(e) =>
                        setFields((f) => ({ ...f, fromName: e.target.value }))
                      }
                      placeholder="Restaurant Name"
                      className="h-10"
                    />
                  </div>
                  {state.grantedScopes.length > 0 ? (
                    <IntegrationGrantedScopes
                      provider="gmail"
                      grantedScopes={state.grantedScopes}
                    />
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl"
                    disabled={busy}
                    onClick={() => setConfirmDisconnectOpen(true)}
                  >
                    Gmail trennen
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Mit Google anmelden — Posteingang und Versand laufen über
                    Gmail, ohne App-Passwort.
                  </p>
                  <Button
                    type="button"
                    className={cn("h-11 rounded-xl", settingsAccentSaveButtonClassName)}
                    disabled={!sendReady}
                    onClick={connectGmail}
                  >
                    Mit Google verbinden
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
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

      <ConfirmDialog
        open={confirmDisconnectOpen}
        onOpenChange={setConfirmDisconnectOpen}
        title="Gmail trennen?"
        description="Posteingang und Versand über dieses Gmail-Konto werden beendet. Du kannst später erneut verbinden oder IMAP/SMTP nutzen."
        confirmLabel="Trennen"
        onConfirm={disconnectGmail}
      />
    </SettingsIntegrationPanel>
  );
}
