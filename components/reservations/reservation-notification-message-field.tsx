"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  DEFAULT_EMAIL_SUBJECT_BY_KIND,
  WHATSAPP_PLACEHOLDER_HINTS,
  type WhatsappMessageKind,
} from "@/lib/whatsapp/reservation-whatsapp-message-config";
import { reservationStatusStripeHex } from "@/lib/reservations/reservation-status-ui";
import { cn } from "@/lib/utils";

export function NotificationPlaceholderLegend({
  className,
}: {
  className?: string;
}) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Platzhalter:{" "}
      {WHATSAPP_PLACEHOLDER_HINTS.map((p, i) => (
        <span key={p.key}>
          {i > 0 ? ", " : null}
          <span className="font-mono text-foreground">{p.key}</span>
        </span>
      ))}
    </p>
  );
}

export function ReservationNotificationMessageField({
  kind,
  title,
  statusLabel,
  statusColorHex,
  description,
  enabled,
  onEnabledChange,
  template,
  onTemplateChange,
  subject,
  onSubjectChange,
  defaultTemplate = DEFAULT_WHATSAPP_TEMPLATES[kind],
  defaultSubject = DEFAULT_EMAIL_SUBJECT_BY_KIND[kind],
  loading,
  disabled,
  className,
}: {
  kind: WhatsappMessageKind;
  title: string;
  statusLabel?: string;
  statusColorHex?: string;
  description?: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  template: string;
  onTemplateChange: (v: string) => void;
  subject?: string;
  onSubjectChange?: (v: string) => void;
  defaultTemplate?: string;
  defaultSubject?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const stripeHex = reservationStatusStripeHex(
    statusColorHex ? { color_hex: statusColorHex } : null,
  );
  const heading = statusLabel ? `${title} (${statusLabel})` : title;

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border border-border/40 bg-background/60 p-3 dark:bg-background/40",
        className,
      )}
    >
      <div className="flex justify-between gap-4">
        <div className="flex min-w-0 flex-1 gap-2.5">
          <span
            className="w-1 shrink-0 self-stretch rounded-full"
            style={{ backgroundColor: stripeHex }}
            aria-hidden
          />
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium leading-snug">{heading}</p>
            {description ? (
              <p className="text-xs leading-snug text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        <Switch
          className="shrink-0 self-center"
          checked={enabled}
          disabled={loading || disabled}
          onCheckedChange={(v) => onEnabledChange(v === true)}
        />
      </div>
      {onSubjectChange != null && subject != null ? (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground">Betreff</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              disabled={loading || disabled || !enabled}
              onClick={() => onSubjectChange(defaultSubject)}
            >
              Standard wiederherstellen
            </Button>
          </div>
          <Input
            value={subject}
            disabled={loading || disabled || !enabled}
            onChange={(e) => onSubjectChange(e.target.value)}
            className="h-10 rounded-xl font-mono text-sm"
            spellCheck={false}
          />
        </div>
      ) : null}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-xs text-muted-foreground">Nachrichtentext</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            disabled={loading || disabled || !enabled}
            onClick={() => onTemplateChange(defaultTemplate)}
          >
            Standard wiederherstellen
          </Button>
        </div>
        <Textarea
          value={template}
          disabled={loading || disabled || !enabled}
          onChange={(e) => onTemplateChange(e.target.value)}
          rows={10}
          className="min-h-[11rem] resize-y rounded-xl font-mono text-xs leading-relaxed"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
