"use client";

import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function AccountingSendSection({
  sendEnabled,
  onSendEnabledChange,
  sendEmail,
  onSendEmailChange,
  sendWhatsapp,
  onSendWhatsappChange,
  recipientEmail,
  recipientPhone,
  whatsappConnected = false,
  alreadySent,
  disabled,
  className,
  compact,
}: {
  sendEnabled: boolean;
  onSendEnabledChange: (v: boolean) => void;
  sendEmail: boolean;
  onSendEmailChange: (v: boolean) => void;
  sendWhatsapp: boolean;
  onSendWhatsappChange: (v: boolean) => void;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  /** WhatsApp-Zeile nur anzeigen, wenn Restaurant WhatsApp verbunden hat. */
  whatsappConnected?: boolean;
  alreadySent?: boolean;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const hasEmail = Boolean(recipientEmail?.trim());
  const hasPhone = Boolean(recipientPhone?.trim());
  const canSendWhatsapp = whatsappConnected && hasPhone;

  useEffect(() => {
    if (!hasEmail && sendEmail) onSendEmailChange(false);
  }, [hasEmail, sendEmail, onSendEmailChange]);

  useEffect(() => {
    if (!canSendWhatsapp && sendWhatsapp) onSendWhatsappChange(false);
  }, [canSendWhatsapp, sendWhatsapp, onSendWhatsappChange]);

  if (alreadySent) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Bereits verschickt — kein erneuter Versand über Gwada.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Versenden</p>
          {!compact ? (
            <p className="text-xs text-muted-foreground">
              PDF als Anhang (E-Mail) bzw. Datei (WhatsApp). Lexware hat keinen
              E-Mail-Versand per API — Versand läuft über Gwada-Kanäle.
            </p>
          ) : null}
        </div>
        <Switch
          checked={sendEnabled}
          onCheckedChange={onSendEnabledChange}
          disabled={disabled}
        />
      </div>
      {sendEnabled ? (
        <div className="space-y-2 rounded-xl border border-border/40 bg-card px-3 py-2.5">
          <label className="flex items-center justify-between gap-3">
            <Label className="text-sm font-normal">
              E-Mail{hasEmail ? "" : " (keine Adresse)"}
            </Label>
            <Switch
              checked={sendEmail}
              onCheckedChange={onSendEmailChange}
              disabled={disabled || !hasEmail}
            />
          </label>
          {whatsappConnected ? (
            <label className="flex items-center justify-between gap-3">
              <Label className="text-sm font-normal">
                WhatsApp{hasPhone ? "" : " (keine Nummer)"}
              </Label>
              <Switch
                checked={sendWhatsapp}
                onCheckedChange={onSendWhatsappChange}
                disabled={disabled || !hasPhone}
              />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
