"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import { GuestPhoneField } from "@/components/phone/guest-phone-field";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { COUNTRIES_REFERENCE_FALLBACK } from "@/lib/constants/countries";
import { formatGuestPhone } from "@/lib/phone/guest-phone";
import {
  sendContactMessageUserMessage,
  type SendContactMessageApiResult,
} from "@/lib/contact-messages/trigger-send-contact-message";
import { useRestaurantChannelConnections } from "@/lib/hooks/use-restaurant-channel-connections";
import { cn } from "@/lib/utils";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Link kopiert.");
  } catch {
    toast.error("Kopieren fehlgeschlagen.");
  }
}

export function ReviewInvitationSheet({
  open,
  onOpenChange,
  restaurantId,
  restaurantName,
  defaultCountryIso2,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | null;
  restaurantName: string;
  defaultCountryIso2: string;
}) {
  const [creating, setCreating] = useState(false);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [phoneCountryIso, setPhoneCountryIso] = useState(defaultCountryIso2);
  const [phoneLocal, setPhoneLocal] = useState("");
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [checkingWhatsapp, setCheckingWhatsapp] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    whatsappEnabled,
    emailEnabled,
    whatsappConnected,
    emailConnected,
    staffInviteEmailAvailable,
    loading: channelsLoading,
  } = useRestaurantChannelConnections(restaurantId);

  const canWhatsapp = whatsappEnabled && whatsappConnected;
  const canEmail =
    emailEnabled && (emailConnected || staffInviteEmailAvailable);
  const hasPhone = Boolean(phoneLocal.trim());
  const hasEmail = guestEmail.trim().includes("@");

  const createInvitation = useCallback(async () => {
    if (!restaurantId) return;
    setCreating(true);
    try {
      const res = await fetch("/api/reviews/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const data = (await res.json()) as {
        error?: string;
        token?: string;
        url?: string;
        expiresAt?: string;
        defaultMessage?: string;
      };
      if (!res.ok) {
        toast.error(
          data.error === "origin_missing"
            ? "Öffentliche URL der App ist nicht konfiguriert."
            : "Bewertungslink konnte nicht erstellt werden.",
        );
        return;
      }
      setInvitationToken(data.token ?? null);
      setReviewUrl(data.url ?? null);
      setExpiresAt(data.expiresAt ?? null);
      setMessageBody(data.defaultMessage ?? "");
    } catch {
      toast.error("Netzwerkfehler.");
    } finally {
      setCreating(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!open) {
      setInvitationToken(null);
      setReviewUrl(null);
      setExpiresAt(null);
      setMessageBody("");
      setGuestFirstName("");
      setGuestEmail("");
      setPhoneLocal("");
      setPhoneCountryIso(defaultCountryIso2);
      setSendWhatsapp(false);
      setSendEmail(false);
      setCopied(false);
      return;
    }
    void createInvitation();
  }, [open, createInvitation, defaultCountryIso2]);

  const guestPhoneForApi = phoneLocal.trim()
    ? (formatGuestPhone(
        phoneCountryIso,
        phoneLocal,
        COUNTRIES_REFERENCE_FALLBACK,
      ) ?? "")
    : "";

  const handleWhatsappToggle = async (next: boolean) => {
    if (!next || !restaurantId) {
      setSendWhatsapp(false);
      return;
    }
    if (!canWhatsapp || !hasPhone) return;

    setCheckingWhatsapp(true);
    try {
      const res = await fetch("/api/reviews/invitations/whatsapp-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          guestPhone: guestPhoneForApi,
        }),
      });
      const data = (await res.json()) as { error?: string; exists?: boolean };
      if (!res.ok) {
        if (data.error === "no_phone") {
          toast.error("Bitte Telefonnummer eingeben.");
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

  const canSendExternal =
    (sendWhatsapp && canWhatsapp && hasPhone) ||
    (sendEmail && canEmail && hasEmail);

  const handleSend = async () => {
    if (!restaurantId || !invitationToken || !canSendExternal) return;
    const text = messageBody.trim();
    if (!text) return;

    setSending(true);
    try {
      const res = await fetch("/api/reviews/invitations/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          invitationToken,
          messageBody: text,
          guestPhone: sendWhatsapp ? guestPhoneForApi : null,
          guestEmail: sendEmail ? guestEmail.trim() : null,
          guestFirstName: guestFirstName.trim() || null,
          sendWhatsapp,
          sendEmail,
          restaurantName,
        }),
      });
      const raw = (await res.json()) as Partial<SendContactMessageApiResult>;
      const data: SendContactMessageApiResult = {
        ok: raw.ok ?? false,
        errors: raw.errors,
        error: raw.error,
      };
      if (!res.ok || !data.ok) {
        const warn = sendContactMessageUserMessage(data);
        toast.error(warn ?? "Senden fehlgeschlagen.");
        return;
      }
      const warn = sendContactMessageUserMessage(data);
      if (warn) toast.warning(warn);
      else toast.success("Einladung gesendet.");
      onOpenChange(false);
    } catch {
      toast.error("Senden fehlgeschlagen.");
    } finally {
      setSending(false);
    }
  };

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleString("de-DE", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className="mx-auto flex max-h-[min(90dvh,640px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Neue Bewertungseinladung
          </DrawerTitle>
          <DrawerDescription className="text-base text-muted-foreground">
            Persönlicher Link für {restaurantName || "das Restaurant"} — 24 Stunden
            gültig.
          </DrawerDescription>
        </DrawerHeader>

        {open && restaurantId ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6">
            {creating ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Link wird erstellt …
              </div>
            ) : reviewUrl ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => {
                    void copyText(reviewUrl);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  Link kopieren
                </Button>
                {expiresLabel ? (
                  <span className="text-xs text-muted-foreground">
                    Gültig bis {expiresLabel}
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="review-invite-name">Name des Gastes (optional)</Label>
                <Input
                  id="review-invite-name"
                  value={guestFirstName}
                  onChange={(e) => setGuestFirstName(e.target.value)}
                  placeholder="Vorname"
                  className="h-11 rounded-xl"
                  disabled={creating || sending}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Telefon (für WhatsApp)</Label>
                <GuestPhoneField
                  countries={COUNTRIES_REFERENCE_FALLBACK}
                  countryIso={phoneCountryIso}
                  onCountryChange={setPhoneCountryIso}
                  localValue={phoneLocal}
                  onLocalChange={setPhoneLocal}
                  disabled={creating || sending}
                  localPlaceholder="Nummer"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="review-invite-email">E-Mail</Label>
                <Input
                  id="review-invite-email"
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="gast@beispiel.de"
                  className="h-11 rounded-xl"
                  disabled={creating || sending}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="review-invite-msg">Nachricht</Label>
              <Textarea
                id="review-invite-msg"
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={6}
                className="min-h-[8rem] resize-y rounded-xl"
                disabled={creating || sending || !reviewUrl}
              />
            </div>

            <div className="space-y-2 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Einladung senden über
              </p>
              {!channelsLoading && !canWhatsapp && !canEmail ? (
                <p className="text-xs text-muted-foreground">
                  Kein Versandkanal aktiv — Link oben kopieren und manuell teilen.
                  Unter Einstellungen → Integrationen WhatsApp oder E-Mail aktivieren.
                </p>
              ) : null}
              <div
                className={cn(
                  "flex items-center justify-between gap-3",
                  (!canWhatsapp || !hasPhone) && "opacity-50",
                )}
              >
                <Label
                  htmlFor="review-inv-wa"
                  className="flex items-center gap-2 text-sm font-normal"
                >
                  <WhatsAppGlyph className="text-[#25D366]" />
                  WhatsApp
                  {checkingWhatsapp ? (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                  ) : null}
                </Label>
                <Switch
                  id="review-inv-wa"
                  size="sm"
                  checked={sendWhatsapp}
                  disabled={
                    !canWhatsapp ||
                    !hasPhone ||
                    creating ||
                    sending ||
                    checkingWhatsapp ||
                    !reviewUrl
                  }
                  onCheckedChange={(v) => void handleWhatsappToggle(v === true)}
                />
              </div>
              <div
                className={cn(
                  "flex items-center justify-between gap-3",
                  (!canEmail || !hasEmail) && "opacity-50",
                )}
              >
                <Label
                  htmlFor="review-inv-email-ch"
                  className="flex items-center gap-2 text-sm font-normal"
                >
                  <Mail className="size-4 text-muted-foreground" />
                  E-Mail
                  {!emailConnected && staffInviteEmailAvailable ? (
                    <span className="text-[10px] text-muted-foreground">
                      (Gwada)
                    </span>
                  ) : null}
                </Label>
                <Switch
                  id="review-inv-email-ch"
                  size="sm"
                  checked={sendEmail}
                  disabled={
                    !canEmail ||
                    !hasEmail ||
                    creating ||
                    sending ||
                    !reviewUrl
                  }
                  onCheckedChange={(v) => setSendEmail(v === true)}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Mindestens ein Kanal wählen zum Senden — sonst Link kopieren. In Gwada
                wird die Nachricht mitgespeichert.
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
                Schließen
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 gap-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
                disabled={
                  sending ||
                  creating ||
                  !reviewUrl ||
                  !canSendExternal ||
                  !messageBody.trim()
                }
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
