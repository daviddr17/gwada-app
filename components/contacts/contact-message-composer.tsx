"use client";

import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function ContactMessageComposer({
  disabled,
  sending,
  hasPhone,
  hasEmail,
  whatsappEnabled,
  emailEnabled,
  defaultSendWhatsapp,
  defaultSendEmail,
  onSend,
  placeholder = "Nachricht schreiben …",
  variant = "unified",
}: {
  disabled?: boolean;
  sending?: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  defaultSendWhatsapp?: boolean;
  defaultSendEmail?: boolean;
  onSend: (params: {
    body: string;
    sendWhatsapp: boolean;
    sendEmail: boolean;
  }) => void | Promise<void>;
  placeholder?: string;
  /** `whatsapp-only` / `email-only`: direkt über den Kanal senden. */
  variant?: "unified" | "whatsapp-only" | "email-only";
}) {
  const [body, setBody] = useState("");
  const [sendWhatsapp, setSendWhatsapp] = useState(
    defaultSendWhatsapp ?? false,
  );
  const [sendEmail, setSendEmail] = useState(defaultSendEmail ?? false);

  const isWhatsappOnly = variant === "whatsapp-only";
  const isEmailOnly = variant === "email-only";
  const canWhatsapp = isWhatsappOnly
    ? whatsappEnabled
    : whatsappEnabled && hasPhone;
  const canEmail = isEmailOnly ? emailEnabled : emailEnabled && hasEmail;

  return (
    <div className="space-y-3 border-t border-border/50 pt-3">
      <Textarea
        value={body}
        disabled={disabled || sending}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="min-h-[4.5rem] resize-y rounded-xl"
      />
      {!isWhatsappOnly && !isEmailOnly ? (
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
            htmlFor="msg-send-wa"
            className="flex items-center gap-2 text-sm font-normal"
          >
            <WhatsAppGlyph className="text-[#25D366]" />
            WhatsApp
          </Label>
          <Switch
            id="msg-send-wa"
            size="sm"
            checked={sendWhatsapp}
            disabled={!canWhatsapp || disabled || sending}
            onCheckedChange={(v) => setSendWhatsapp(v === true)}
          />
        </div>
        <div
          className={cn(
            "flex items-center justify-between gap-3",
            !canEmail && "opacity-50",
          )}
        >
          <Label
            htmlFor="msg-send-email"
            className="flex items-center gap-2 text-sm font-normal"
          >
            E-Mail
          </Label>
          <Switch
            id="msg-send-email"
            size="sm"
            checked={sendEmail}
            disabled={!canEmail || disabled || sending}
            onCheckedChange={(v) => setSendEmail(v === true)}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          In Gwada wird die Nachricht immer gespeichert. Externe Kanäle hängen
          bei Reservierungen den Reservierungsblock an.
        </p>
      </div>
      ) : null}
      <Button
        type="button"
        className="h-11 w-full gap-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
        disabled={
          disabled ||
          sending ||
          !body.trim() ||
          (isWhatsappOnly && !canWhatsapp) ||
          (isEmailOnly && !canEmail)
        }
        onClick={() => {
          const text = body.trim();
          if (!text) return;
          void onSend({
            body: text,
            sendWhatsapp: isWhatsappOnly ? true : sendWhatsapp && canWhatsapp,
            sendEmail: isEmailOnly ? true : sendEmail && canEmail,
          });
          setBody("");
        }}
      >
        {isEmailOnly ? (
          <Mail className="size-4" aria-hidden />
        ) : isWhatsappOnly ? (
          <WhatsAppGlyph className="size-4" />
        ) : (
          <Send className="size-4" />
        )}
        {sending
          ? "Senden …"
          : isEmailOnly
            ? "E-Mail senden"
            : isWhatsappOnly
              ? "Senden"
              : "Senden"}
      </Button>
    </div>
  );
}
