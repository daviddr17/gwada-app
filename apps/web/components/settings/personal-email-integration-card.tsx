"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  SmtpConnectionFields,
  type SmtpConnectionFieldValues,
} from "@/components/integrations/smtp-connection-fields";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  SettingsIntegrationPanel,
  integrationStatusBadgeConnected,
  integrationStatusBadgeSecondary,
} from "@/components/settings/settings-integration-panel";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import { INTEGRATION_PANEL_ACCENT } from "@/lib/ui/integration-panel-accent";
import type { PersonalEmailIntegrationResponse } from "@/lib/types/restaurant-integration";
import { cn } from "@/lib/utils";

type MailboxMode = "smtp" | "gmail" | "outlook";

export function PersonalEmailIntegrationCard() {
  const searchParams = useSearchParams();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permLoading } = useRestaurantPermissions();
  const canUse = has("contacts.read");
  const [state, setState] = useState<PersonalEmailIntegrationResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);
  const [mailboxMode, setMailboxMode] = useState<MailboxMode>("gmail");
  const [fields, setFields] = useState<SmtpConnectionFieldValues>({
    email: "",
    password: "",
    smtpHost: "",
    smtpPort: "",
    imapHost: "",
    imapPort: "",
    fromName: "",
  });
  const oauthToastHandled = useRef(false);

  const applyResponse = (data: PersonalEmailIntegrationResponse) => {
    setState(data);
    if (data.status === "gmail") setMailboxMode("gmail");
    else if (data.status === "outlook") setMailboxMode("outlook");
    else if (data.status === "custom") setMailboxMode("smtp");
    setFields({
      email: data.fromEmail ?? "",
      password: "",
      smtpHost: data.smtpHost ?? "",
      smtpPort: data.smtpPort ?? "",
      imapHost: data.imapHost ?? "",
      imapPort: data.imapPort ?? "",
      fromName: data.fromName ?? "",
    });
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
        `/api/integrations/email/personal?${new URLSearchParams({ restaurantId })}`,
      );
      const data = (await res.json()) as PersonalEmailIntegrationResponse & {
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Persönliches Postfach konnte nicht geladen werden.");
        setLoading(false);
        return;
      }
      applyResponse(data);
    } catch {
      toast.error("Netzwerkfehler beim Laden des persönlichen Postfachs.");
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (oauthToastHandled.current) return;
    if (searchParams.get("email") !== "connected") return;
    if (searchParams.get("message") !== "personal") return;
    oauthToastHandled.current = true;
    void load();
  }, [searchParams, load]);

  const connectOAuth = (provider: "gmail" | "outlook") => {
    if (!restaurantId) return;
    window.location.assign(
      `/api/integrations/email/${provider}/connect?${new URLSearchParams({
        restaurantId,
        purpose: "personal",
      })}`,
    );
  };

  const saveSmtp = async () => {
    if (!restaurantId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/email/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          action: "smtp",
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
      toast.success("Persönliches Postfach gespeichert.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!restaurantId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/email/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, action: "disconnect" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Trennen fehlgeschlagen.");
        throw new Error("disconnect_failed");
      }
      toast.success("Persönliches Postfach getrennt.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const connected =
    state?.status === "gmail" ||
    state?.status === "outlook" ||
    state?.status === "custom";
  const badge = connected
    ? integrationStatusBadgeConnected(
        state?.status === "gmail"
          ? "Gmail"
          : state?.status === "outlook"
            ? "Outlook"
            : "IMAP/SMTP",
      )
    : integrationStatusBadgeSecondary("Nicht verbunden");

  return (
    <SettingsIntegrationPanel
      title="Mein Postfach"
      description="Privates Mitarbeiter-Postfach — nur für dich sichtbar. Das geteilte Kontakt-Postfach bleibt unverändert."
      icon={<UserRound className="text-muted-foreground" />}
      accentColor={INTEGRATION_PANEL_ACCENT.email}
      badge={badge}
      summaryLine={
        connected ? (
          <>
            Verbunden:{" "}
            <span className="font-mono text-foreground">
              {state?.fromEmail ?? "Postfach"}
            </span>
          </>
        ) : (
          "Optional — z. B. persönliche Gmail/Outlook"
        )
      }
      loading={permLoading || !workspaceReady || loading}
      denied={!canUse}
      deniedMessage="Keine Berechtigung für Nachrichten."
      noRestaurant={workspaceReady && !restaurantId}
      noRestaurantMessage="Wähle zuerst ein Restaurant im Workspace."
    >
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["gmail", "Gmail"],
            ["outlook", "Outlook"],
            ["smtp", "IMAP / SMTP"],
          ] as const
        ).map(([mode, label]) => (
          <Button
            key={mode}
            type="button"
            variant={mailboxMode === mode ? "secondary" : "outline"}
            className="h-9 rounded-xl px-2 text-xs sm:text-sm"
            onClick={() => setMailboxMode(mode)}
          >
            {label}
          </Button>
        ))}
      </div>

      {mailboxMode === "smtp" ? (
        <div className="space-y-3">
          <SmtpConnectionFields
            idPrefix="personal-email"
            values={fields}
            disabled={busy}
            passwordConfigured={state?.passwordConfigured}
            onChange={(patch) => setFields((f) => ({ ...f, ...patch }))}
          />
          <Button
            type="button"
            className={cn("h-11 rounded-xl", settingsAccentSaveButtonClassName)}
            disabled={busy}
            onClick={() => void saveSmtp()}
          >
            Persönliches IMAP speichern
          </Button>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 px-3 py-3">
          {connected &&
          ((mailboxMode === "gmail" && state?.status === "gmail") ||
            (mailboxMode === "outlook" && state?.status === "outlook")) ? (
            <>
              <p className="text-sm">
                Verbunden als{" "}
                <span className="font-mono font-medium">
                  {state?.fromEmail ?? mailboxMode}
                </span>
              </p>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                disabled={busy}
                onClick={() => setConfirmDisconnectOpen(true)}
              >
                Trennen
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Nur für dich — nicht das geteilte Kontakt-Postfach.
              </p>
              <Button
                type="button"
                className={cn(
                  "h-11 rounded-xl",
                  settingsAccentSaveButtonClassName,
                )}
                disabled={
                  busy ||
                  (mailboxMode === "gmail"
                    ? !state?.gmailOAuthConfigured
                    : !state?.outlookOAuthConfigured)
                }
                onClick={() => connectOAuth(mailboxMode)}
              >
                {mailboxMode === "gmail"
                  ? "Persönliches Gmail verbinden"
                  : "Persönliches Outlook verbinden"}
              </Button>
            </>
          )}
        </div>
      )}

      {connected && mailboxMode === "smtp" ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl"
          disabled={busy}
          onClick={() => setConfirmDisconnectOpen(true)}
        >
          Trennen
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirmDisconnectOpen}
        onOpenChange={setConfirmDisconnectOpen}
        title="Persönliches Postfach trennen?"
        description="Dein privates Postfach wird in Gwada getrennt. Das geteilte Kontakt-Postfach bleibt bestehen."
        confirmLabel="Trennen"
        onConfirm={disconnect}
      />
    </SettingsIntegrationPanel>
  );
}
