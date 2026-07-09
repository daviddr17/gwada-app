"use client";

import { useCallback, useEffect, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { ContactMessageChatViewport } from "@/components/contacts/contact-message-chat-viewport";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { DisplayReservationRow } from "@/lib/display/display-reservations-server";
import {
  sendContactMessageUserMessage,
  type SendContactMessageApiResult,
} from "@/lib/contact-messages/trigger-send-contact-message";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";
import { cn } from "@/lib/utils";

type ChannelState = {
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  whatsappConnected: boolean;
  emailConnected: boolean;
};

export function DisplayReservationMessageSheet({
  open,
  onOpenChange,
  reservation,
  restaurantName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation: DisplayReservationRow | null;
  restaurantName: string | null;
}) {
  const [body, setBody] = useState("");
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [checkingWhatsapp, setCheckingWhatsapp] = useState(false);
  const [messages, setMessages] = useState<ContactMessageRow[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [channels, setChannels] = useState<ChannelState>({
    whatsappEnabled: false,
    emailEnabled: false,
    whatsappConnected: false,
    emailConnected: false,
  });

  const hasPhone = Boolean(reservation?.guest_phone?.trim());
  const hasEmail = Boolean(reservation?.guest_email?.trim()?.includes("@"));
  const canWhatsapp =
    channels.whatsappEnabled && channels.whatsappConnected && hasPhone;
  const canEmail = channels.emailEnabled && channels.emailConnected && hasEmail;

  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch("/api/display/reservations/channels-status", {
        credentials: "include",
      });
      const data = (await res.json()) as ChannelState;
      if (res.ok) setChannels(data);
    } catch {
      /* ignore */
    }
  }, []);

  const loadMessages = useCallback(async () => {
    if (!reservation) return;
    setLoadingMessages(true);
    try {
      const res = await fetch(
        `/api/display/reservations/${encodeURIComponent(reservation.id)}/message`,
        { credentials: "include" },
      );
      const data = (await res.json()) as {
        messages?: ContactMessageRow[];
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Nachrichten konnten nicht geladen werden.");
        setMessages([]);
        return;
      }
      setMessages(data.messages ?? []);
    } catch {
      toast.error("Nachrichten konnten nicht geladen werden.");
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [reservation]);

  useEffect(() => {
    if (!open) return;
    setBody("");
    setSendWhatsapp(false);
    setSendEmail(false);
    setMessages([]);
    void loadChannels();
    void loadMessages();
  }, [open, loadChannels, loadMessages]);

  const handleWhatsappToggle = async (next: boolean) => {
    if (!next || !reservation) {
      setSendWhatsapp(false);
      return;
    }
    if (!canWhatsapp) return;

    setCheckingWhatsapp(true);
    try {
      const res = await fetch(
        `/api/display/reservations/${encodeURIComponent(reservation.id)}/whatsapp-check`,
        { credentials: "include" },
      );
      const data = (await res.json()) as { error?: string; exists?: boolean };
      if (!res.ok) {
        if (data.error === "no_phone") {
          toast.error("Keine Telefonnummer für WhatsApp hinterlegt.");
        } else if (data.error === "whatsapp_not_connected") {
          toast.error("WhatsApp ist nicht verbunden.");
        } else {
          toast.error("WhatsApp-Nummer konnte nicht geprüft werden.");
        }
        setSendWhatsapp(false);
        return;
      }
      if (!data.exists) {
        toast.error("Diese Telefonnummer ist bei WhatsApp nicht registriert.");
        setSendWhatsapp(false);
        return;
      }
      setSendWhatsapp(true);
    } catch {
      toast.error("WhatsApp-Nummer konnte nicht geprüft werden.");
      setSendWhatsapp(false);
    } finally {
      setCheckingWhatsapp(false);
    }
  };

  const handleSend = async () => {
    if (!reservation) return;
    const text = body.trim();
    if (!text) return;

    setSending(true);
    try {
      const res = await fetch(
        `/api/display/reservations/${encodeURIComponent(reservation.id)}/message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            messageBody: text,
            sendWhatsapp,
            sendEmail,
            restaurantName,
          }),
        },
      );
      const raw = (await res.json()) as Partial<SendContactMessageApiResult>;
      const data: SendContactMessageApiResult = {
        ok: raw.ok ?? false,
        errors: raw.errors,
        error: raw.error,
      };
      if (!res.ok || !data.ok) {
        if (data.errors?.includes("no_contact")) {
          toast.error(
            "Kein Kontakt verknüpft — Nachricht kann nicht gespeichert werden.",
          );
        } else {
          const warn = sendContactMessageUserMessage(data);
          toast.error(warn ?? "Senden fehlgeschlagen.");
        }
        return;
      }
      const warn = sendContactMessageUserMessage(data);
      if (warn) toast.warning(warn);
      else toast.success("Nachricht gesendet.");
      setBody("");
      void loadMessages();
    } catch {
      toast.error("Senden fehlgeschlagen.");
    } finally {
      setSending(false);
    }
  };

  const guestLabel = reservation
    ? `${reservation.guest_first_name} ${reservation.guest_last_name}`.trim()
    : "";

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("compact")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Nachrichten
          </DrawerTitle>
          <DrawerDescription className="text-base">
            {reservation ? (
              <>
                Reservierung #{reservation.reservation_number} · {guestLabel}
              </>
            ) : null}
          </DrawerDescription>
        </DrawerHeader>

        {open && reservation ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6">
            <div className="space-y-2 rounded-xl border border-border/50 bg-muted/10 px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Nachrichtenverlauf
              </p>
              <ContactMessageChatViewport
                messages={messages}
                loading={loadingMessages}
                threadKey={reservation.id}
                className="max-h-[min(32dvh,260px)] overflow-x-hidden overscroll-x-none"
              />
            </div>

            <Textarea
              value={body}
              disabled={sending}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Nachricht an den Gast …"
              rows={4}
              className="min-h-[5.5rem] resize-y rounded-xl"
            />

            <div className="space-y-2 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Zusätzlich senden über
              </p>
              <div
                className={cn(
                  "flex items-center justify-between gap-3",
                  !canWhatsapp && "opacity-50",
                )}
              >
                <Label
                  htmlFor="disp-msg-wa"
                  className="flex items-center gap-2 text-sm font-normal"
                >
                  <WhatsAppGlyph className="text-[#25D366]" />
                  WhatsApp
                  {checkingWhatsapp ? (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                  ) : null}
                </Label>
                <Switch
                  id="disp-msg-wa"
                  size="sm"
                  checked={sendWhatsapp}
                  disabled={!canWhatsapp || sending || checkingWhatsapp}
                  onCheckedChange={(v) => void handleWhatsappToggle(v === true)}
                />
              </div>
              <div
                className={cn(
                  "flex items-center justify-between gap-3",
                  !canEmail && "opacity-50",
                )}
              >
                <Label
                  htmlFor="disp-msg-email"
                  className="flex items-center gap-2 text-sm font-normal"
                >
                  <Mail className="size-4 text-muted-foreground" />
                  E-Mail
                </Label>
                <Switch
                  id="disp-msg-email"
                  size="sm"
                  checked={sendEmail}
                  disabled={!canEmail || sending}
                  onCheckedChange={(v) => setSendEmail(v === true)}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                In Gwada wird die Nachricht immer gespeichert. Externe Kanäle nur
                wenn aktiviert und hinterlegt.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 rounded-xl"
                disabled={sending}
                onClick={() => onOpenChange(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                className={cn("h-11 flex-1 gap-2 ", brandActionButtonRoundedClassName)}
                disabled={sending || !body.trim()}
                onClick={() => void handleSend()}
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Senden
              </Button>
            </div>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

export function reservationHasContactChannel(r: DisplayReservationRow): boolean {
  return (
    Boolean(r.guest_phone?.trim()) ||
    Boolean(r.guest_email?.trim()?.includes("@"))
  );
}
