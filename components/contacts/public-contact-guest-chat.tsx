"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ContactMessageChatViewport } from "@/components/contacts/contact-message-chat-viewport";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";
import type { PublicContactMessage } from "@/lib/contacts/public-contact-messages-server";

type SessionInfo = {
  contactId: string;
  restaurantId: string;
  restaurantName: string;
  guestFirstName: string;
};

type AutoResendUi =
  | { status: "idle" }
  | { status: "pending" }
  | {
      status: "sent";
      channels: ("email" | "whatsapp")[];
    }
  | { status: "skipped"; reason: string }
  | { status: "error"; message: string };

function toMessageRows(
  messages: PublicContactMessage[],
  restaurantId: string,
  contactId: string,
): ContactMessageRow[] {
  return messages.map((m) => ({
    id: m.id,
    restaurant_id: restaurantId,
    contact_id: contactId,
    platform: "gwada",
    direction: m.direction,
    body: m.body,
    reservation_id: null,
    sent_by: null,
    delivery_status: "delivered",
    created_at: m.created_at,
    attachments: m.attachments,
  }));
}

const fetchOpts: RequestInit = { credentials: "include" };

function sessionErrorMessage(code: string | undefined): string {
  switch (code) {
    case "invalid_code":
      return "Zugangscode ungültig oder abgelaufen.";
    case "rate_limited":
      return "Zu viele Fehlversuche. Bitte später erneut versuchen.";
    case "resend_cooldown":
      return "Bitte warten Sie kurz, bevor Sie einen neuen Code anfordern.";
    case "daily_limit":
      return "Heute wurden bereits zu viele Codes angefordert. Bitte morgen erneut oder das Restaurant kontaktieren.";
    case "session_required":
      return "Bitte melden Sie sich mit Ihrem Zugangscode an.";
    default:
      return "Aktion fehlgeschlagen.";
  }
}

function channelsLabel(channels: ("email" | "whatsapp")[]): string {
  const parts = channels.map((c) => (c === "email" ? "E-Mail" : "WhatsApp"));
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} und ${parts[1]}`;
}

function skippedAutoResendMessage(reason: string): string {
  switch (reason) {
    case "valid_code_exists":
      return "Ihr letzter Zugangscode ist noch gültig — bitte in der letzten WhatsApp- oder E-Mail-Nachricht nachsehen.";
    case "no_delivery_channel":
      return "Ein automatischer Versand ist nicht möglich (keine E-Mail oder WhatsApp hinterlegt). Bitte wenden Sie sich an das Restaurant.";
    default:
      return "";
  }
}

export function PublicContactGuestChat() {
  const searchParams = useSearchParams();
  const contactFromUrl =
    searchParams.get("kontakt")?.trim() ??
    searchParams.get("contact")?.trim() ??
    "";

  const [contactId, setContactId] = useState(contactFromUrl);
  const [code, setCode] = useState("");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<PublicContactMessage[]>([]);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [autoResend, setAutoResend] = useState<AutoResendUi>({ status: "idle" });
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const autoResendStartedRef = useRef(false);

  useEffect(() => {
    if (contactFromUrl) setContactId(contactFromUrl);
  }, [contactFromUrl]);

  useEffect(() => {
    if (!contactFromUrl) return;
    const params = new URLSearchParams({ kontakt: contactFromUrl });
    window.history.replaceState(
      null,
      "",
      `/nachrichten/kontakt?${params.toString()}`,
    );
  }, [contactFromUrl]);

  const loadThread = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ kontakt: contactId });
      const res = await fetch(
        `/api/public/contact-messages?${q.toString()}`,
        fetchOpts,
      );
      const data = (await res.json()) as {
        session?: SessionInfo;
        messages?: PublicContactMessage[];
        error?: string;
      };
      if (!res.ok) {
        if (data.error === "session_required") {
          setSession(null);
          setMessages([]);
        } else {
          toast.error(sessionErrorMessage(data.error));
        }
        return;
      }
      setSession(data.session!);
      setMessages(data.messages ?? []);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  const requestAutoResend = useCallback(async () => {
    if (!contactId) return;
    setAutoResend({ status: "pending" });
    try {
      const res = await fetch("/api/public/contact-messages/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ kontakt: contactId, action: "auto_resend" }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        sent?: boolean;
        channels?: ("email" | "whatsapp")[];
        reason?: string;
        error?: string;
        retryAfterMs?: number;
      };

      if (!res.ok) {
        const msg = sessionErrorMessage(data.error);
        setAutoResend({ status: "error", message: msg });
        if (data.error !== "resend_cooldown") {
          toast.error(msg);
        }
        return;
      }

      if (data.sent && data.channels?.length) {
        setAutoResend({ status: "sent", channels: data.channels });
        return;
      }

      const reason = data.reason ?? "unknown";
      const hint = skippedAutoResendMessage(reason);
      setAutoResend({ status: "skipped", reason });
      if (hint && reason !== "valid_code_exists") {
        toast.message(hint);
      }
    } catch {
      setAutoResend({
        status: "error",
        message: "Code konnte nicht angefordert werden.",
      });
    }
  }, [contactId]);

  const checkSession = useCallback(async () => {
    if (!contactId) {
      setCheckingSession(false);
      return;
    }
    setCheckingSession(true);
    try {
      const q = new URLSearchParams({ kontakt: contactId });
      const res = await fetch(
        `/api/public/contact-messages/session?${q.toString()}`,
        fetchOpts,
      );
      const data = (await res.json()) as {
        authenticated?: boolean;
        session?: SessionInfo;
      };
      if (data.authenticated && data.session) {
        setSession(data.session);
        autoResendStartedRef.current = false;
        await loadThread();
      } else {
        setSession(null);
        setMessages([]);
        if (contactFromUrl && !autoResendStartedRef.current) {
          autoResendStartedRef.current = true;
          void requestAutoResend();
        }
      }
    } finally {
      setCheckingSession(false);
    }
  }, [contactId, contactFromUrl, loadThread, requestAutoResend]);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const verifyCode = async () => {
    if (!contactId || code.length !== 6) return;
    setVerifying(true);
    try {
      const res = await fetch("/api/public/contact-messages/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ kontakt: contactId, code, action: "verify" }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        session?: SessionInfo;
        error?: string;
      };
      if (!res.ok) {
        toast.error(sessionErrorMessage(data.error));
        return;
      }
      if (data.session) setSession(data.session);
      setCode("");
      toast.success("Angemeldet.");
      await loadThread();
    } finally {
      setVerifying(false);
    }
  };

  const send = async () => {
    const text = body.trim();
    if (!text || !session) return;
    setSending(true);
    try {
      const res = await fetch("/api/public/contact-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          kontakt: contactId,
          messageBody: text,
        }),
      });
      if (!res.ok) {
        toast.error(sessionErrorMessage((await res.json()).error));
        return;
      }
      setBody("");
      toast.success("Nachricht gesendet.");
      void loadThread();
    } finally {
      setSending(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-sm text-muted-foreground" aria-busy="true">
          …
        </p>
      </div>
    );
  }

  if (!session) {
    const autoResendHint =
      autoResend.status === "pending" ? (
        <p className="text-xs text-muted-foreground" aria-busy="true">
          Zugang abgelaufen — neuer Code wird angefordert …
        </p>
      ) : autoResend.status === "sent" ? (
        <p className="rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Ein neuer Zugangscode wurde per{" "}
          <span className="font-medium text-foreground">
            {channelsLabel(autoResend.channels)}
          </span>{" "}
          gesendet. Bitte dort nachsehen und unten eingeben.
        </p>
      ) : autoResend.status === "skipped" ? (
        skippedAutoResendMessage(autoResend.reason) ? (
          <p className="text-xs text-muted-foreground">
            {skippedAutoResendMessage(autoResend.reason)}
          </p>
        ) : null
      ) : autoResend.status === "error" ? (
        <p className="text-xs text-destructive">{autoResend.message}</p>
      ) : null;

    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-xl">Nachrichten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contactFromUrl ? autoResendHint : null}
            {!contactFromUrl ? (
              <div className="space-y-2">
                <Label htmlFor="guest-contact-id">Kontakt-ID</Label>
                <Input
                  id="guest-contact-id"
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  placeholder="UUID aus Ihrer Einladung"
                  autoComplete="off"
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="guest-code">Zugangscode (6 Ziffern)</Label>
              <Input
                id="guest-code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                maxLength={6}
                placeholder="aus WhatsApp oder E-Mail"
                autoComplete="one-time-code"
              />
              <p className="text-xs text-muted-foreground">
                Der Code steht in der Benachrichtigung (nicht in der URL). Bei
                abgelaufenem Zugang wird beim Öffnen des Links automatisch ein
                neuer Code versendet, sofern E-Mail oder WhatsApp hinterlegt ist.
              </p>
            </div>
            <Button
              type="button"
              className="w-full rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={!contactId || code.length !== 6 || verifying}
              onClick={() => void verifyCode()}
            >
              {verifying ? "Prüfen …" : "Chat öffnen"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm"
              disabled={
                !contactId ||
                autoResend.status === "pending"
              }
              onClick={() => void requestAutoResend()}
            >
              {autoResend.status === "pending"
                ? "Code wird gesendet …"
                : "Code erneut senden"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const rows = toMessageRows(
    messages,
    session.restaurantId,
    session.contactId,
  );

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {session.restaurantName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Hallo {session.guestFirstName} — hier sehen Sie Ihren Gwada-Chat.
        </p>
      </div>
      <Card className="flex min-h-0 flex-1 flex-col border-border/50 shadow-card">
        <CardContent className="flex min-h-[min(55dvh,480px)] flex-col gap-3 p-4">
          <ContactMessageChatViewport
            messages={rows}
            loading={loading}
            threadKey={session.contactId}
            className="min-h-0 flex-1"
          />
          <div className="space-y-2 border-t border-border/50 pt-3">
            <Textarea
              value={body}
              disabled={sending}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Ihre Antwort …"
              rows={3}
              className="min-h-[4rem] resize-y rounded-xl"
            />
            <Button
              type="button"
              className="h-11 w-full rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={sending || !body.trim()}
              onClick={() => void send()}
            >
              {sending ? "Senden …" : "Antworten"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
