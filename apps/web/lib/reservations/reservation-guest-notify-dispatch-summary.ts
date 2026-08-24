import { isSilentClientSendResult } from "@/lib/network/client-send-abort";
import type { EmailDispatchApiResult } from "@/lib/reservations/email-dispatch-client-response";
import {
  emailDispatchUserMessage,
} from "@/lib/reservations/trigger-email-dispatch";
import type { WhatsappDispatchApiResult } from "@/lib/reservations/trigger-whatsapp-dispatch";
import {
  whatsappDispatchUserMessage,
} from "@/lib/reservations/trigger-whatsapp-dispatch";

export type GuestNotifyChannel = "whatsapp" | "email";

export type GuestNotifyDispatchOutcome =
  | "sent"
  | "not_enabled"
  | "skipped"
  | "failed";

export type GuestNotifyChannelSummary = {
  channel: GuestNotifyChannel;
  outcome: GuestNotifyDispatchOutcome;
  detail?: string;
};

const CHANNEL_LABEL: Record<GuestNotifyChannel, string> = {
  whatsapp: "WhatsApp",
  email: "E-Mail",
};

/** Gast-Daten fehlen — kein Systemfehler, kein Warning-Toast. */
const SOFT_GUEST_SKIP_LABEL: Record<string, Partial<Record<GuestNotifyChannel, string>>> =
  {
    no_phone: { whatsapp: "WhatsApp: keine Nummer" },
    no_email: { email: "E-Mail: keine Adresse" },
  };

export function isGuestNotifySoftSkipError(
  error: string | undefined,
): boolean {
  return error != null && error in SOFT_GUEST_SKIP_LABEL;
}

function softSkipLabel(
  channel: GuestNotifyChannel,
  error: string | undefined,
): string | null {
  if (!error) return null;
  return SOFT_GUEST_SKIP_LABEL[error]?.[channel] ?? null;
}

function dispatchWasSkipped(result: {
  skipped?: string | boolean;
}): boolean {
  if (result.skipped === true) return true;
  return typeof result.skipped === "string" && result.skipped.length > 0;
}

function dispatchDetailMessage(
  channel: GuestNotifyChannel,
  result: WhatsappDispatchApiResult | EmailDispatchApiResult,
  isSuperadmin?: boolean,
): string | null {
  return channel === "whatsapp"
    ? whatsappDispatchUserMessage(result as WhatsappDispatchApiResult)
    : emailDispatchUserMessage(result as EmailDispatchApiResult, {
        isSuperadmin,
      });
}

export function summarizeGuestNotifyChannel(params: {
  channel: GuestNotifyChannel;
  enabled: boolean;
  result: WhatsappDispatchApiResult | EmailDispatchApiResult | null;
  isSuperadmin?: boolean;
}): GuestNotifyChannelSummary {
  const { channel, enabled, result, isSuperadmin } = params;
  const label = CHANNEL_LABEL[channel];

  if (!enabled) {
    return { channel, outcome: "not_enabled" };
  }
  if (isSilentClientSendResult(result)) {
    return { channel, outcome: "skipped" };
  }
  if (!result) {
    return {
      channel,
      outcome: "failed",
      detail: `${label}-Versand fehlgeschlagen (Netzwerk).`,
    };
  }
  if (result.error) {
    const soft = softSkipLabel(channel, result.error);
    if (soft) {
      return { channel, outcome: "skipped", detail: soft };
    }
    return {
      channel,
      outcome: "failed",
      detail:
        dispatchDetailMessage(channel, result, isSuperadmin) ??
        `${label}-Versand fehlgeschlagen.`,
    };
  }
  if (dispatchWasSkipped(result)) {
    return {
      channel,
      outcome: "skipped",
      detail:
        dispatchDetailMessage(channel, result, isSuperadmin) ??
        `${label} nicht gesendet.`,
    };
  }
  if (result.ok) {
    return { channel, outcome: "sent" };
  }
  return {
    channel,
    outcome: "failed",
    detail: `${label}-Versand fehlgeschlagen.`,
  };
}

function formatChannelSummary(summary: GuestNotifyChannelSummary): string {
  const label = CHANNEL_LABEL[summary.channel];
  switch (summary.outcome) {
    case "sent":
      return `${label} gesendet`;
    case "not_enabled":
      return `${label} aus`;
    case "skipped":
      return summary.detail ?? `${label} nicht gesendet`;
    case "failed":
      return summary.detail ?? `${label} fehlgeschlagen`;
  }
}

/**
 * Bestätigungs-Toast: nur tatsächlich Versendetes, solange mindestens ein Kanal
 * gesendet hat. Wurde gar nichts versendet → Hinweise (fehlende Daten, aus, Fehler).
 */
export function reservationGuestNotifyToastDescription(
  summaries: GuestNotifyChannelSummary[],
): string {
  const sent = summaries.filter((summary) => summary.outcome === "sent");
  if (sent.length > 0) {
    return sent.map(formatChannelSummary).join(" · ");
  }

  const enabledSummaries = summaries.filter(
    (summary) => summary.outcome !== "not_enabled",
  );
  const hintSummaries =
    enabledSummaries.length > 0 ? enabledSummaries : summaries;

  return hintSummaries.map(formatChannelSummary).join(" · ");
}

export function reservationConfirmNotificationToastContent(
  summaries: GuestNotifyChannelSummary[],
): { title: string; description: string } {
  return {
    title: "Reservierung bestätigt.",
    description: reservationGuestNotifyToastDescription(summaries),
  };
}

/**
 * Warning nur bei echten Versandproblemen — nicht bei fehlender Telefonnummer/E-Mail
 * (die gehören in den Bestätigungs-/Speichern-Toast).
 */
export function reservationDispatchWarningMessage(
  channel: GuestNotifyChannel,
  result: WhatsappDispatchApiResult | EmailDispatchApiResult | null,
  options?: { isSuperadmin?: boolean },
): string | null {
  if (!result || isSilentClientSendResult(result)) return null;
  if (isGuestNotifySoftSkipError(result.error)) return null;
  return channel === "whatsapp"
    ? whatsappDispatchUserMessage(result as WhatsappDispatchApiResult)
    : emailDispatchUserMessage(result as EmailDispatchApiResult, {
        isSuperadmin: options?.isSuperadmin === true,
      });
}
