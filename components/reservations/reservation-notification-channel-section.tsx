"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NotificationPlaceholderLegend,
  ReservationNotificationMessageField,
} from "@/components/reservations/reservation-notification-message-field";
import {
  NOTIFICATION_KIND_STATUS_CODE,
  NOTIFICATION_MESSAGE_FIELDS,
  TIMED_NOTIFICATION_KINDS,
  type ReservationNotificationKind,
} from "@/lib/reservations/reservation-notification-message-config";
import { cn } from "@/lib/utils";

export type NotificationKindFieldState = {
  enabled: boolean;
  template: string;
  setEnabled: (v: boolean) => void;
  setTemplate: (v: string) => void;
  subject?: string;
  setSubject?: (v: string) => void;
};

export function ReservationNotificationChannelSection({
  sectionId,
  headerIcon,
  headerTitle,
  sectionClassName,
  intro,
  statusColorsByCode,
  fieldsByKind,
  reminderHours,
  thanksHours,
  loading,
  channelDisabled,
  showEmailSubjects,
  emailSenderName,
  onEmailSenderNameChange,
  collapsible = false,
  defaultOpen = false,
}: {
  sectionId: string;
  headerIcon: ReactNode;
  headerTitle: string;
  sectionClassName: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  intro?: ReactNode;
  statusColorsByCode: Map<string, string>;
  fieldsByKind: Record<ReservationNotificationKind, NotificationKindFieldState>;
  reminderHours: { value: string; onChange: (v: string) => void };
  thanksHours: { value: string; onChange: (v: string) => void };
  loading?: boolean;
  channelDisabled?: boolean;
  showEmailSubjects?: boolean;
  emailSenderName?: string;
  onEmailSenderNameChange?: (v: string) => void;
}) {
  const disabled = loading || channelDisabled;
  const [open, setOpen] = useState(defaultOpen);

  const body = (
    <>
      {intro}
      {showEmailSubjects && onEmailSenderNameChange != null ? (
        <div className="max-w-md space-y-1.5">
          <Label
            htmlFor={`${sectionId}-sender-name`}
            className="text-xs text-muted-foreground"
          >
            Absendername (alle E-Mails)
          </Label>
          <Input
            id={`${sectionId}-sender-name`}
            value={emailSenderName ?? ""}
            disabled={disabled}
            onChange={(e) => onEmailSenderNameChange(e.target.value)}
            placeholder="z. B. Restaurant Beispiel"
            className="h-10 rounded-xl text-sm"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            Leer lassen = Name aus E-Mail-Integration bzw. SMTP-Absender.
          </p>
        </div>
      ) : null}
      <NotificationPlaceholderLegend />

      {NOTIFICATION_MESSAGE_FIELDS.map((meta) => {
        if (TIMED_NOTIFICATION_KINDS.includes(meta.kind as "reminder" | "thanks")) {
          return null;
        }
        const code = NOTIFICATION_KIND_STATUS_CODE[meta.kind];
        const field = fieldsByKind[meta.kind];
        return (
          <ReservationNotificationMessageField
            key={meta.kind}
            kind={meta.kind}
            title={meta.title}
            statusLabel={meta.statusLabel}
            statusColorHex={code ? statusColorsByCode.get(code) : undefined}
            description={meta.description}
            enabled={field.enabled}
            onEnabledChange={field.setEnabled}
            template={field.template}
            onTemplateChange={field.setTemplate}
            subject={showEmailSubjects ? field.subject : undefined}
            onSubjectChange={showEmailSubjects ? field.setSubject : undefined}
            loading={loading}
            disabled={disabled}
          />
        );
      })}

      {(() => {
        const meta = NOTIFICATION_MESSAGE_FIELDS.find((m) => m.kind === "reminder")!;
        const code = NOTIFICATION_KIND_STATUS_CODE.reminder;
        const field = fieldsByKind.reminder;
        return (
          <>
            <ReservationNotificationMessageField
              kind="reminder"
              title={meta.title}
              statusColorHex={code ? statusColorsByCode.get(code) : undefined}
              description={meta.description}
              enabled={field.enabled}
              onEnabledChange={field.setEnabled}
              template={field.template}
              onTemplateChange={field.setTemplate}
              subject={showEmailSubjects ? field.subject : undefined}
              onSubjectChange={showEmailSubjects ? field.setSubject : undefined}
              loading={loading}
              disabled={disabled}
            />
            <div className="max-w-[8rem] space-y-1 -mt-1">
              <Label className="text-xs text-muted-foreground">Stunden vorher</Label>
              <Input
                type="number"
                min={0}
                max={168}
                step={0.5}
                disabled={disabled || !field.enabled}
                value={reminderHours.value}
                onChange={(e) => reminderHours.onChange(e.target.value)}
                className="h-10 rounded-xl tabular-nums"
              />
            </div>
          </>
        );
      })()}

      {(() => {
        const meta = NOTIFICATION_MESSAGE_FIELDS.find((m) => m.kind === "thanks")!;
        const code = NOTIFICATION_KIND_STATUS_CODE.thanks;
        const field = fieldsByKind.thanks;
        return (
          <>
            <ReservationNotificationMessageField
              kind="thanks"
              title={meta.title}
              statusColorHex={code ? statusColorsByCode.get(code) : undefined}
              description={meta.description}
              enabled={field.enabled}
              onEnabledChange={field.setEnabled}
              template={field.template}
              onTemplateChange={field.setTemplate}
              subject={showEmailSubjects ? field.subject : undefined}
              onSubjectChange={showEmailSubjects ? field.setSubject : undefined}
              loading={loading}
              disabled={disabled}
            />
            <div className="max-w-[8rem] space-y-1 -mt-1">
              <Label className="text-xs text-muted-foreground">Stunden danach</Label>
              <Input
                type="number"
                min={0}
                max={168}
                step={0.5}
                disabled={disabled || !field.enabled}
                value={thanksHours.value}
                onChange={(e) => thanksHours.onChange(e.target.value)}
                className="h-10 rounded-xl tabular-nums"
              />
            </div>
          </>
        );
      })()}
    </>
  );

  return (
    <section
      className={cn(sectionClassName, collapsible && !open && "gap-0")}
      aria-labelledby={sectionId}
    >
      {collapsible ? (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-lg text-left outline-none transition-colors hover:bg-muted/30 focus-visible:ring-3 focus-visible:ring-ring/50 -m-1 p-1"
          aria-expanded={open}
          aria-controls={`${sectionId}-panel`}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="flex min-w-0 items-center gap-2">
            {headerIcon}
            <span id={sectionId} className="text-sm font-medium">
              {headerTitle}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      ) : (
        <div className="flex items-center gap-2">
          {headerIcon}
          <h3 id={sectionId} className="text-sm font-medium">
            {headerTitle}
          </h3>
        </div>
      )}
      {(!collapsible || open) ? (
        <div
          id={collapsible ? `${sectionId}-panel` : undefined}
          className={cn("space-y-4", collapsible && "pt-1")}
        >
          {body}
        </div>
      ) : null}
    </section>
  );
}

export const reservationWhatsappSettingsSectionClassName = cn(
  "space-y-4 rounded-xl border border-[#25D366]/30 bg-[#25D366]/[0.08] p-4",
  "dark:border-[#25D366]/25 dark:bg-[#25D366]/[0.1]",
);

export const reservationEmailSettingsSectionClassName = cn(
  "space-y-4 rounded-xl border border-border/50 bg-muted/25 p-4",
  "dark:bg-muted/15",
);
