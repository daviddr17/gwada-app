import {
  appendGuestNotifyMessage,
  type ReservationDispatchOptions,
} from "@/lib/reservations/append-guest-notify-message";
import { ensureRestaurantReservationSettings } from "@/lib/reservations/reservation-settings-server";
import { buildGuestManageUrl } from "@/lib/reservations/guest-manage-url";
import {
  buildWhatsappMessage,
  type WhatsappImmediateKind,
  type WhatsappMessageKind,
} from "@/lib/whatsapp/reservation-whatsapp-message-config";
import type { ReservationMessageContext } from "@/lib/whatsapp/reservation-message-templates";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import { appendReviewRequestToMessage } from "@/lib/reviews/review-request-append-server";
import {
  finalizeOutboundWhatsappMessage,
  insertPendingOutboundWhatsappMessage,
} from "@/lib/contact-messages/outbound-whatsapp-db-server";
import { wahaPseudoContactIdFromChatId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { resolveContactIdByWhatsappChat } from "@/lib/contacts/resolve-contact-by-whatsapp-chat";
import { wahaSendText } from "@/lib/whatsapp/waha-send-text";
import { fetchRestaurantWhatsappIntegration } from "@/lib/supabase/restaurant-integrations-db";
import { RESERVATION_STATUS_EMBED } from "@/lib/supabase/reservations-db";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import { wahaGetSession } from "@/lib/waha/waha-client";
import { getWahaServerConfigAdmin } from "@/lib/waha/waha-config";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ReservationWhatsappSettings = {
  whatsapp_received_enabled: boolean;
  whatsapp_confirmed_enabled: boolean;
  whatsapp_reminder_enabled: boolean;
  whatsapp_reminder_hours_before: number;
  whatsapp_thanks_enabled: boolean;
  whatsapp_thanks_hours_after: number;
  whatsapp_cancelled_enabled: boolean;
  whatsapp_declined_enabled: boolean;
  whatsapp_no_show_enabled: boolean;
  guest_manage_url_template: string | null;
  whatsapp_received_template: string | null;
  whatsapp_confirmed_template: string | null;
  whatsapp_reminder_template: string | null;
  whatsapp_thanks_template: string | null;
  whatsapp_cancelled_template: string | null;
  whatsapp_declined_template: string | null;
  whatsapp_no_show_template: string | null;
};

export type ReservationForWhatsapp = {
  id: string;
  restaurant_id: string;
  reservation_number: number;
  guest_pin: string;
  guest_first_name: string;
  guest_last_name: string;
  guest_phone: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  notify_whatsapp: boolean;
  status_code: string;
  contact_id: string | null;
};

export type OutboxKind = WhatsappMessageKind;

const SCHEDULED_KINDS: OutboxKind[] = ["reminder", "thanks"];

export function isWhatsappKindEnabled(
  settings: ReservationWhatsappSettings,
  kind: WhatsappMessageKind,
): boolean {
  switch (kind) {
    case "received":
      return settings.whatsapp_received_enabled;
    case "confirmed":
      return settings.whatsapp_confirmed_enabled;
    case "reminder":
      return settings.whatsapp_reminder_enabled;
    case "thanks":
      return settings.whatsapp_thanks_enabled;
    case "cancelled":
      return settings.whatsapp_cancelled_enabled;
    case "declined":
      return settings.whatsapp_declined_enabled;
    case "no_show":
      return settings.whatsapp_no_show_enabled;
  }
}

async function isWhatsappSessionWorking(
  restaurantId: string,
): Promise<boolean> {
  const config = await getWahaServerConfigAdmin();
  if (!config) return false;
  const name = wahaSessionNameForRestaurant(restaurantId);
  const res = await wahaGetSession(config, name);
  return res.ok && res.data?.status === "WORKING";
}

export async function fetchReservationForWhatsapp(
  sb: SupabaseClient,
  reservationId: string,
): Promise<ReservationForWhatsapp | null> {
  const { data, error } = await sb
    .from("reservations")
    .select(
      `
      id,
      restaurant_id,
      reservation_number,
      guest_pin,
      guest_first_name,
      guest_last_name,
      guest_phone,
      party_size,
      starts_at,
      ends_at,
      notify_whatsapp,
      contact_id,
      ${RESERVATION_STATUS_EMBED} ( code )
    `,
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (error || !data) return null;
  const st = data.reservation_statuses as { code: string } | { code: string }[] | null;
  const status = Array.isArray(st) ? st[0] : st;
  return {
    id: data.id as string,
    restaurant_id: data.restaurant_id as string,
    reservation_number: data.reservation_number as number,
    guest_pin: data.guest_pin as string,
    guest_first_name: data.guest_first_name as string,
    guest_last_name: data.guest_last_name as string,
    guest_phone: data.guest_phone as string | null,
    party_size: data.party_size as number,
    starts_at: data.starts_at as string,
    ends_at: data.ends_at as string,
    notify_whatsapp: Boolean(data.notify_whatsapp),
    status_code: status?.code ?? "pending",
    contact_id: (data.contact_id as string | null) ?? null,
  };
}

const SETTINGS_SELECT = [
  "whatsapp_received_enabled",
  "whatsapp_confirmed_enabled",
  "whatsapp_reminder_enabled",
  "whatsapp_reminder_hours_before",
  "whatsapp_thanks_enabled",
  "whatsapp_thanks_hours_after",
  "whatsapp_cancelled_enabled",
  "whatsapp_declined_enabled",
  "whatsapp_no_show_enabled",
  "guest_manage_url_template",
  "whatsapp_received_template",
  "whatsapp_confirmed_template",
  "whatsapp_reminder_template",
  "whatsapp_thanks_template",
  "whatsapp_cancelled_template",
  "whatsapp_declined_template",
  "whatsapp_no_show_template",
].join(", ");

export async function fetchReservationWhatsappSettings(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<ReservationWhatsappSettings | null> {
  await ensureRestaurantReservationSettings(sb, restaurantId);
  const { data, error } = await sb
    .from("restaurant_reservation_settings")
    .select(SETTINGS_SELECT)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as ReservationWhatsappSettings;
}

function messageContext(
  row: ReservationForWhatsapp,
  settings: ReservationWhatsappSettings | null,
  timeZone: string,
): ReservationMessageContext {
  return {
    guestFirstName: row.guest_first_name,
    guestLastName: row.guest_last_name,
    partySize: row.party_size,
    startsAt: new Date(row.starts_at),
    timeZone,
    reservationNumber: row.reservation_number,
    guestPin: row.guest_pin,
    manageUrl: buildGuestManageUrl(
      settings?.guest_manage_url_template,
      row.reservation_number,
      row.guest_pin,
    ),
  };
}

function buildText(
  kind: OutboxKind,
  row: ReservationForWhatsapp,
  settings: ReservationWhatsappSettings | null,
  timeZone: string,
): string {
  return buildWhatsappMessage(
    settings,
    kind,
    messageContext(row, settings, timeZone),
  );
}

async function upsertOutbox(
  sb: SupabaseClient,
  row: ReservationForWhatsapp,
  kind: OutboxKind,
  sendAt: Date,
): Promise<void> {
  const { data: existing } = await sb
    .from("reservation_whatsapp_outbox")
    .select("sent_at")
    .eq("reservation_id", row.id)
    .eq("message_kind", kind)
    .maybeSingle();
  if (existing?.sent_at) return;

  await sb.from("reservation_whatsapp_outbox").upsert(
    {
      restaurant_id: row.restaurant_id,
      reservation_id: row.id,
      message_kind: kind,
      send_at: sendAt.toISOString(),
      sent_at: null,
      last_error: null,
      cancelled_at: null,
    },
    { onConflict: "reservation_id,message_kind" },
  );
}

async function cancelOutboxKinds(
  sb: SupabaseClient,
  reservationId: string,
  kinds: OutboxKind[],
): Promise<void> {
  if (kinds.length === 0) return;
  await sb
    .from("reservation_whatsapp_outbox")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("reservation_id", reservationId)
    .in("message_kind", kinds)
    .is("sent_at", null);
}

export type { ReservationDispatchOptions };

export async function sendImmediateKind(
  sb: SupabaseClient,
  row: ReservationForWhatsapp,
  kind: WhatsappImmediateKind,
  settings: ReservationWhatsappSettings | null,
  options?: ReservationDispatchOptions,
): Promise<{
  sent: boolean;
  error?: string;
  messageBody?: string;
  messageId?: string;
  wahaMessageId?: string | null;
  threadContactId?: string;
}> {
  const chatId = guestPhoneToWhatsAppChatId(row.guest_phone);
  if (!chatId) return { sent: false, error: "no_phone" };

  const timeZone = await fetchRestaurantTimezoneServer(sb, row.restaurant_id);
  const text = appendGuestNotifyMessage(
    buildText(kind, row, settings, timeZone),
    options?.guestNotifyMessage,
  );

  const linkedContactId =
    row.contact_id ??
    (await resolveContactIdByWhatsappChat(sb, {
      restaurantId: row.restaurant_id,
      chatId,
    }));
  const threadContactId =
    linkedContactId ?? wahaPseudoContactIdFromChatId(chatId);

  const pending = await insertPendingOutboundWhatsappMessage(sb, {
    restaurantId: row.restaurant_id,
    threadContactId,
    body: text,
    reservationId: row.id,
    deliveryStatus: "pending",
  });

  const result = await wahaSendText({
    restaurantId: row.restaurant_id,
    chatId,
    text,
  });

  if (!result.ok) {
    if (pending.ok) {
      await finalizeOutboundWhatsappMessage(sb, {
        restaurantId: row.restaurant_id,
        messageId: pending.messageId,
        deliveryStatus: "failed",
      });
    }
    await sb.from("reservation_whatsapp_outbox").upsert(
      {
        restaurant_id: row.restaurant_id,
        reservation_id: row.id,
        message_kind: kind,
        send_at: new Date().toISOString(),
        last_error: result.error,
      },
      { onConflict: "reservation_id,message_kind" },
    );
    return { sent: false, error: result.error };
  }

  if (pending.ok) {
    await finalizeOutboundWhatsappMessage(sb, {
      restaurantId: row.restaurant_id,
      messageId: pending.messageId,
      deliveryStatus: "sent",
      wahaMessageId: result.wahaMessageId,
    });
  }

  await sb.from("reservation_whatsapp_outbox").upsert(
    {
      restaurant_id: row.restaurant_id,
      reservation_id: row.id,
      message_kind: kind,
      send_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      last_error: null,
      cancelled_at: null,
    },
    { onConflict: "reservation_id,message_kind" },
  );
  return {
    sent: true,
    messageBody: text,
    messageId: pending.ok ? pending.messageId : undefined,
    wahaMessageId: result.wahaMessageId,
    threadContactId,
  };
}

export async function scheduleTimedMessages(
  sb: SupabaseClient,
  row: ReservationForWhatsapp,
  settings: ReservationWhatsappSettings,
): Promise<void> {
  const terminal = ["cancelled", "declined", "no_show"].includes(row.status_code);
  if (terminal) {
    await cancelOutboxKinds(sb, row.id, SCHEDULED_KINDS);
    return;
  }

  const starts = new Date(row.starts_at);
  const ends = new Date(row.ends_at);

  if (settings.whatsapp_reminder_enabled && settings.whatsapp_reminder_hours_before > 0) {
    const sendAt = new Date(
      starts.getTime() - settings.whatsapp_reminder_hours_before * 60 * 60 * 1000,
    );
    if (sendAt.getTime() > Date.now()) {
      await upsertOutbox(sb, row, "reminder", sendAt);
    } else {
      await cancelOutboxKinds(sb, row.id, ["reminder"]);
    }
  } else {
    await cancelOutboxKinds(sb, row.id, ["reminder"]);
  }

  if (settings.whatsapp_thanks_enabled && settings.whatsapp_thanks_hours_after > 0) {
    const sendAt = new Date(
      ends.getTime() + settings.whatsapp_thanks_hours_after * 60 * 60 * 1000,
    );
    if (sendAt.getTime() > Date.now()) {
      await upsertOutbox(sb, row, "thanks", sendAt);
    } else {
      await cancelOutboxKinds(sb, row.id, ["thanks"]);
    }
  } else {
    await cancelOutboxKinds(sb, row.id, ["thanks"]);
  }
}

export type DispatchEvent =
  | "created"
  | "confirmed"
  | "cancelled"
  | "declined"
  | "no_show"
  | "rescheduled";

const EVENT_TO_KIND: Record<
  Exclude<DispatchEvent, "created" | "rescheduled">,
  WhatsappImmediateKind
> = {
  confirmed: "confirmed",
  cancelled: "cancelled",
  declined: "declined",
  no_show: "no_show",
};

export type ReservationWhatsappDispatchResult = {
  ok: boolean;
  skipped?: string;
  error?: string;
  messageBody?: string;
  messageId?: string;
  wahaMessageId?: string | null;
  threadContactId?: string;
};

async function sendForEvent(
  sb: SupabaseClient,
  row: ReservationForWhatsapp,
  settings: ReservationWhatsappSettings,
  kind: WhatsappImmediateKind,
  options?: ReservationDispatchOptions,
): Promise<ReservationWhatsappDispatchResult> {
  if (!isWhatsappKindEnabled(settings, kind)) {
    return { ok: true, skipped: "disabled" };
  }
  if (["cancelled", "declined", "no_show"].includes(kind)) {
    await cancelOutboxKinds(sb, row.id, SCHEDULED_KINDS);
  }
  const send = await sendImmediateKind(sb, row, kind, settings, options);
  if (!send.sent) {
    return { ok: false, error: send.error ?? "send_failed" };
  }
  return {
    ok: true,
    messageBody: send.messageBody,
    messageId: send.messageId,
    wahaMessageId: send.wahaMessageId,
    threadContactId: send.threadContactId,
  };
}

export async function dispatchReservationWhatsapp(
  sb: SupabaseClient,
  reservationId: string,
  event: DispatchEvent,
  options?: ReservationDispatchOptions,
): Promise<ReservationWhatsappDispatchResult> {
  const row = await fetchReservationForWhatsapp(sb, reservationId);
  if (!row) return { ok: false, error: "reservation_not_found" };
  if (!row.notify_whatsapp) return { ok: true, skipped: "notify_whatsapp_off" };

  const integration = await fetchRestaurantWhatsappIntegration(sb, row.restaurant_id);
  if (integration?.status !== "working") {
    return { ok: true, skipped: "whatsapp_not_connected" };
  }
  if (!(await isWhatsappSessionWorking(row.restaurant_id))) {
    return { ok: true, skipped: "waha_session_not_working" };
  }

  const settings = await fetchReservationWhatsappSettings(sb, row.restaurant_id);
  if (!settings) return { ok: true, skipped: "no_settings" };

  if (event === "rescheduled") {
    await scheduleTimedMessages(sb, row, settings);
    return { ok: true };
  }

  if (event === "created") {
    let sent: ReservationWhatsappDispatchResult = { ok: true };
    if (row.status_code === "pending") {
      sent = await sendForEvent(sb, row, settings, "received", options);
      if (!sent.ok) return sent;
    } else if (row.status_code === "confirmed") {
      sent = await sendForEvent(sb, row, settings, "confirmed", options);
      if (!sent.ok) return sent;
    } else if (row.status_code === "cancelled") {
      sent = await sendForEvent(sb, row, settings, "cancelled", options);
      if (!sent.ok) return sent;
    } else if (row.status_code === "declined") {
      sent = await sendForEvent(sb, row, settings, "declined", options);
      if (!sent.ok) return sent;
    } else if (row.status_code === "no_show") {
      sent = await sendForEvent(sb, row, settings, "no_show", options);
      if (!sent.ok) return sent;
    }
    await scheduleTimedMessages(sb, row, settings);
    return sent;
  }

  const kind = EVENT_TO_KIND[event];
  const result = await sendForEvent(sb, row, settings, kind, options);
  if (!result.ok) return result;
  if (event === "confirmed") {
    await scheduleTimedMessages(sb, row, settings);
  }
  return result;
}

const TERMINAL_STATUS = new Set(["cancelled", "declined", "no_show"]);

export async function processDueWhatsappOutbox(
  sb: SupabaseClient,
  limit = 50,
): Promise<{ processed: number; sent: number; failed: number }> {
  const { data: due, error } = await sb
    .from("reservation_whatsapp_outbox")
    .select("id, reservation_id, message_kind")
    .is("sent_at", null)
    .is("cancelled_at", null)
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true })
    .limit(limit);

  if (error || !due?.length) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const settingsByRestaurant = new Map<string, ReservationWhatsappSettings | null>();
  const timezoneByRestaurant = new Map<string, string>();

  for (const item of due) {
    const row = await fetchReservationForWhatsapp(sb, item.reservation_id as string);
    if (!row || !row.notify_whatsapp) {
      await sb
        .from("reservation_whatsapp_outbox")
        .update({
          cancelled_at: new Date().toISOString(),
          last_error: "reservation_ineligible",
        })
        .eq("id", item.id);
      continue;
    }

    const kind = item.message_kind as OutboxKind;
    if (kind !== "reminder" && kind !== "thanks") {
      continue;
    }

    if (TERMINAL_STATUS.has(row.status_code)) {
      await sb
        .from("reservation_whatsapp_outbox")
        .update({ cancelled_at: new Date().toISOString() })
        .eq("id", item.id);
      continue;
    }

    const integration = await fetchRestaurantWhatsappIntegration(sb, row.restaurant_id);
    if (
      integration?.status !== "working" ||
      !(await isWhatsappSessionWorking(row.restaurant_id))
    ) {
      await sb
        .from("reservation_whatsapp_outbox")
        .update({ last_error: "whatsapp_unavailable" })
        .eq("id", item.id);
      failed++;
      continue;
    }

    const chatId = guestPhoneToWhatsAppChatId(row.guest_phone);
    if (!chatId) {
      await sb
        .from("reservation_whatsapp_outbox")
        .update({ last_error: "no_phone", cancelled_at: new Date().toISOString() })
        .eq("id", item.id);
      failed++;
      continue;
    }

    let settings = settingsByRestaurant.get(row.restaurant_id);
    if (settings === undefined) {
      settings = await fetchReservationWhatsappSettings(sb, row.restaurant_id);
      settingsByRestaurant.set(row.restaurant_id, settings);
    }

    if (!settings || !isWhatsappKindEnabled(settings, kind)) {
      await sb
        .from("reservation_whatsapp_outbox")
        .update({ cancelled_at: new Date().toISOString() })
        .eq("id", item.id);
      continue;
    }

    let timeZone = timezoneByRestaurant.get(row.restaurant_id);
    if (timeZone === undefined) {
      timeZone = await fetchRestaurantTimezoneServer(sb, row.restaurant_id);
      timezoneByRestaurant.set(row.restaurant_id, timeZone);
    }

    let text = buildText(kind, row, settings, timeZone);
    if (kind === "thanks") {
      text = await appendReviewRequestToMessage(sb, {
        restaurantId: row.restaurant_id,
        reservationId: row.id,
        text,
        channel: "whatsapp",
      });
    }
    const result = await wahaSendText({
      restaurantId: row.restaurant_id,
      chatId,
      text,
    });

    if (result.ok) {
      await sb
        .from("reservation_whatsapp_outbox")
        .update({ sent_at: new Date().toISOString(), last_error: null })
        .eq("id", item.id);
      sent++;
    } else {
      await sb
        .from("reservation_whatsapp_outbox")
        .update({ last_error: result.error })
        .eq("id", item.id);
      failed++;
    }
  }

  return { processed: due.length, sent, failed };
}
