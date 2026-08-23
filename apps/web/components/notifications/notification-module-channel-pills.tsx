"use client";

import type { ComponentType } from "react";
import { Bell, Mail } from "lucide-react";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import {
  NOTIFICATION_MODULES,
  type NotificationModuleId,
} from "@/lib/notifications/notification-modules";
import type { NotificationModuleToggles } from "@/lib/notifications/notification-preferences";
import { cn } from "@/lib/utils";

export type NotificationDeliveryChannel = "inApp" | "email" | "whatsapp";

const CHANNEL_OPTIONS: {
  id: NotificationDeliveryChannel;
  label: string;
  shortLabel: string;
  Icon: ComponentType<{ className?: string }>;
}[] = [
  { id: "inApp", label: "Glocke", shortLabel: "Glocke", Icon: Bell },
  { id: "email", label: "E-Mail", shortLabel: "E-Mail", Icon: Mail },
  {
    id: "whatsapp",
    label: "WhatsApp",
    shortLabel: "WA",
    Icon: WhatsAppGlyph,
  },
];

function moduleDescription(moduleId: NotificationModuleId): string {
  const label = NOTIFICATION_MODULES[moduleId].settingsInAppLabel;
  return label.replace(/\s+in der Glocke$/i, "").trim();
}

type NotificationModuleChannelPillsProps = {
  inApp: boolean;
  email: boolean;
  whatsapp: boolean;
  emailDisabled?: boolean;
  whatsappDisabled?: boolean;
  emailDisabledHint?: string;
  whatsappDisabledHint?: string;
  onChange: (channel: NotificationDeliveryChannel, enabled: boolean) => void;
  className?: string;
};

export function NotificationModuleChannelPills({
  inApp,
  email,
  whatsapp,
  emailDisabled = false,
  whatsappDisabled = false,
  emailDisabledHint,
  whatsappDisabledHint,
  onChange,
  className,
}: NotificationModuleChannelPillsProps) {
  const values: Record<NotificationDeliveryChannel, boolean> = {
    inApp,
    email,
    whatsapp,
  };

  return (
    <div
      className={cn(
        "inline-flex max-w-full shrink-0 gap-1 rounded-lg border border-border/60 bg-muted/40 p-1",
        className,
      )}
      role="group"
      aria-label="Kanäle"
    >
      {CHANNEL_OPTIONS.map(({ id, label, shortLabel, Icon }) => {
        const disabled =
          id === "email" ? emailDisabled : id === "whatsapp" ? whatsappDisabled : false;
        const active = values[id];
        const disabledHint =
          id === "email" ? emailDisabledHint : id === "whatsapp" ? whatsappDisabledHint : undefined;

        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            title={disabled ? disabledHint : undefined}
            aria-pressed={active}
            aria-label={`${label}${active ? " aktiv" : ""}`}
            className={cn(
              "flex min-w-[2.85rem] flex-1 items-center justify-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-[color,background-color,border-color,box-shadow] sm:min-w-[3.5rem] sm:text-xs",
              active
                ? "border-accent/55 bg-accent/22 text-foreground shadow-sm"
                : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              disabled &&
                "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-muted-foreground",
            )}
            onClick={() => {
              if (disabled) return;
              onChange(id, !active);
            }}
          >
            <Icon
              className={cn(
                "size-3.5 shrink-0 sm:size-4",
                id === "whatsapp" && "[&_path]:fill-current",
              )}
              aria-hidden
            />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

type NotificationModuleChannelRowProps = {
  moduleId: NotificationModuleId;
  inApp: boolean;
  email: boolean;
  whatsapp: boolean;
  emailDisabled?: boolean;
  whatsappDisabled?: boolean;
  emailDisabledHint?: string;
  whatsappDisabledHint?: string;
  onChange: (channel: NotificationDeliveryChannel, enabled: boolean) => void;
};

export function NotificationModuleChannelRow({
  moduleId,
  inApp,
  email,
  whatsapp,
  emailDisabled,
  whatsappDisabled,
  emailDisabledHint,
  whatsappDisabledHint,
  onChange,
}: NotificationModuleChannelRowProps) {
  const mod = NOTIFICATION_MODULES[moduleId];

  return (
    <li className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{mod.label}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {moduleDescription(moduleId)}
        </p>
      </div>
      <NotificationModuleChannelPills
        inApp={inApp}
        email={email}
        whatsapp={whatsapp}
        emailDisabled={emailDisabled}
        whatsappDisabled={whatsappDisabled}
        emailDisabledHint={emailDisabledHint}
        whatsappDisabledHint={whatsappDisabledHint}
        onChange={onChange}
        className="w-full sm:w-auto sm:max-w-[15.5rem]"
      />
    </li>
  );
}

type NotificationGroupBulkChannelActionsProps = {
  moduleIds: NotificationModuleId[];
  emailAvailable: boolean;
  whatsappAvailable: boolean;
  onSetChannel: (
    channel: NotificationDeliveryChannel,
    enabled: boolean,
    moduleIds: NotificationModuleId[],
  ) => void;
  onSetAllChannels: (enabled: boolean, moduleIds: NotificationModuleId[]) => void;
};

export function NotificationGroupBulkChannelActions({
  moduleIds,
  emailAvailable,
  whatsappAvailable,
  onSetChannel,
  onSetAllChannels,
}: NotificationGroupBulkChannelActionsProps) {
  if (moduleIds.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
      <button
        type="button"
        className="font-medium text-foreground/80 underline-offset-2 hover:text-foreground hover:underline"
        onClick={() => onSetAllChannels(true, moduleIds)}
      >
        Alle Kanäle
      </button>
      <span aria-hidden>·</span>
      <button
        type="button"
        className="underline-offset-2 hover:text-foreground hover:underline"
        onClick={() => onSetAllChannels(false, moduleIds)}
      >
        Alle aus
      </button>
      <span className="hidden text-border sm:inline" aria-hidden>|</span>
      <button
        type="button"
        className="underline-offset-2 hover:text-foreground hover:underline"
        onClick={() => onSetChannel("inApp", true, moduleIds)}
      >
        Glocke
      </button>
      {emailAvailable ? (
        <button
          type="button"
          className="underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => onSetChannel("email", true, moduleIds)}
        >
          E-Mail
        </button>
      ) : null}
      {whatsappAvailable ? (
        <button
          type="button"
          className="underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => onSetChannel("whatsapp", true, moduleIds)}
        >
          WhatsApp
        </button>
      ) : null}
    </div>
  );
}

export function isModuleChannelEnabled(
  toggles: NotificationModuleToggles,
  moduleId: NotificationModuleId,
): boolean {
  return toggles[moduleId] !== false;
}

export function isModulePushEnabled(
  toggles: NotificationModuleToggles,
  moduleId: NotificationModuleId,
): boolean {
  return toggles[moduleId] === true;
}
