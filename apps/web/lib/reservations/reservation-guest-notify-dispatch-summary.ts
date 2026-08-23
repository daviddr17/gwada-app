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
    : emailDispatchUserMessage(result as EmailDispatchApiResult, { isSuperadmin });
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

export function reservationConfirmNotificationToastContent(
  summaries: GuestNotifyChannelSummary[],
): { title: string; description: string } {
  return {
    title: "Reservierung bestätigt.",
    description: summaries.map(formatChannelSummary).join(" · "),
  };
}
