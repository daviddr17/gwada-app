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
  computeReservationReminderSendAt,
  isReservationOutboxSendAtTooStale,
  isReservationReminderTooLate,
  resolveReservationThanksSendAt,
  shouldScheduleReservationReminder,
} from "@/lib/reservations/reservation-timed-notification-schedule";
import {
  finalizeOutboundWhatsappMessage,
  insertPendingOutboundWhatsappMessage,
} from "@/lib/contact-messages/outbound-whatsapp-db-server";
import { wahaPseudoContactIdFromChatId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { resolveContactIdByWhatsappChat } from "@/lib/contacts/resolve-contact-by-whatsapp-chat";
import { wahaSendText } from "@/lib/whatsapp/waha-send-text";
import {
  fetchRestaurantWhatsappIntegration,
  integrationStateFromWahaSession,
  upsertRestaurantWhatsappIntegration,
} from "@/lib/supabase/restaurant-integrations-db";
import { RESERVATION_STATUS_EMBED } from "@/lib/supabase/reservations-db";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import { wahaGetSession } from "@/lib/waha/waha-client";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
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

/**
 * Live-WAHA entscheidet — nicht nur DB-Status.
 * Verhindert Toast „nicht verbunden“, wenn die Session läuft, die DB aber
 * (z. B. nach Restart / fehlgeschlagenem User-Upsert) noch veraltet ist.
 */
async function ensureWhatsappReadyForDispatch(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<"ok" | "whatsapp_not_connected" | "waha_session_not_working"> {
  const integration = await fetchRestaurantWhatsappIntegration(sb, restaurantId);
  const config = await getWahaServerConfigForRestaurantAdmin(restaurantId);
  if (!config) {
    return integration?.status === "working"
      ? "waha_session_not_working"
      : "whatsapp_not_connected";
  }

  const name = wahaSessionNameForRestaurant(restaurantId);
  const res = await wahaGetSession(config, name);

  if (res.ok && res.data?.status === "WORKING") {
    if (integration?.status !== "working") {
      const mapped = integrationStateFromWahaSession(res.data, "working");
      const { error } = await upsertRestaurantWhatsappIntegration(sb, restaurantId, {
        status: mapped.status,
        phone_number: mapped.phone_number,
        display_name: mapped.display_name,
        connected_at: mapped.connected_at,
        last_error: null,
      });
      if (error) {
        console.warn("[whatsapp-dispatch] sync working status", error);
      }
    }
    return "ok";
  }

  if (res.ok) {
    const mapped = integrationStateFromWahaSession(
      res.data,
      integration?.status ?? "disconnected",
    );
    if (mapped.status !== integration?.status) {
      await upsertRestaurantWhatsappIntegration(sb, restaurantId, {
        status: mapped.status,
        phone_number: mapped.phone_number,
        display_name: mapped.display_name,
        connected_at: mapped.connected_at,
        last_error: null,
      });
    }
  }

  if (integration?.status === "working") {
    return "waha_session_not_working";
  }
  return "whatsapp_not_connected";
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
    .select("id, sent_at")
    .eq("reservation_id", row.id)
    .eq("message_kind", kind)
    .maybeSingle();

  // Bereits gesendet: nie zurücksetzen (sonst Doppelversand beim nächsten Cron).
  if (existing?.sent_at) return;

  if (existing?.id) {
    // Nur Planung aktualisieren — sent_at/claimed_at nicht anfassen.
    await sb
      .from("reservation_whatsapp_outbox")
      .update({
        send_at: sendAt.toISOString(),
        last_error: null,
        cancelled_at: null,
      })
      .eq("id", existing.id)
      .is("sent_at", null);
    return;
  }

  const { error: insertError } = await sb
    .from("reservation_whatsapp_outbox")
    .insert({
      restaurant_id: row.restaurant_id,
      reservation_id: row.id,
      message_kind: kind,
      send_at: sendAt.toISOString(),
      sent_at: null,
      last_error: null,
      cancelled_at: null,
    });
  if (!insertError) return;
  // Unique-Race: zweiter Insert → Update ohne sent_at zu löschen
  if (
    insertError.code !== "23505" &&
    !String(insertError.message ?? "").toLowerCase().includes("duplicate")
  ) {
    console.warn("[reservation-whatsapp-outbox] insert", insertError.message);
    return;
  }
  await sb
    .from("reservation_whatsapp_outbox")
    .update({
      send_at: sendAt.toISOString(),
      last_error: null,
      cancelled_at: null,
    })
    .eq("reservation_id", row.id)
    .eq("message_kind", kind)
    .is("sent_at", null);
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
  // Idempotenz: zweiter Dispatch (Retry/Deploy/Timeout) darf nicht erneut an WAHA.
  const { data: prior } = await sb
    .from("reservation_whatsapp_outbox")
    .select("id, sent_at, claimed_at")
    .eq("reservation_id", row.id)
    .eq("message_kind", kind)
    .maybeSingle();
  if (prior?.sent_at) {
    return { sent: true };
  }
  const claimedAtMs = prior?.claimed_at ? Date.parse(String(prior.claimed_at)) : NaN;
  if (Number.isFinite(claimedAtMs) && Date.now() - claimedAtMs < 10 * 60 * 1000) {
    // Timeout nach erfolgreichem WAHA-Send: nicht nochmal schicken.
    return { sent: true };
  }

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

  const claimNow = new Date().toISOString();
  if (prior?.id) {
    await sb
      .from("reservation_whatsapp_outbox")
      .update({
        claimed_at: claimNow,
        last_error: "sending",
        send_at: claimNow,
      })
      .eq("id", prior.id)
      .is("sent_at", null);
  } else {
    await sb.from("reservation_whatsapp_outbox").upsert(
      {
        restaurant_id: row.restaurant_id,
        reservation_id: row.id,
        message_kind: kind,
        send_at: claimNow,
        sent_at: null,
        claimed_at: claimNow,
        last_error: "sending",
        cancelled_at: null,
      },
      { onConflict: "reservation_id,message_kind" },
    );
  }

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
    const timeout = /aborted due to timeout|TimeoutError|signal timed out/i.test(
      result.error,
    );
    await sb
      .from("reservation_whatsapp_outbox")
      .update({
        last_error: result.error,
        // Timeout: Claim behalten — Retry würde sonst nach WAHA-Erfolg doppelt senden.
        claimed_at: timeout ? claimNow : null,
      })
      .eq("reservation_id", row.id)
      .eq("message_kind", kind)
      .is("sent_at", null);
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

  const starts = row.starts_at;

  if (settings.whatsapp_reminder_enabled && settings.whatsapp_reminder_hours_before > 0) {
    const sendAt = computeReservationReminderSendAt(
      starts,
      settings.whatsapp_reminder_hours_before,
    );
    if (shouldScheduleReservationReminder(sendAt)) {
      await upsertOutbox(sb, row, "reminder", sendAt);
    } else {
      await cancelOutboxKinds(sb, row.id, ["reminder"]);
    }
  } else {
    await cancelOutboxKinds(sb, row.id, ["reminder"]);
  }

  if (settings.whatsapp_thanks_enabled && settings.whatsapp_thanks_hours_after > 0) {
    const sendAt = resolveReservationThanksSendAt(
      starts,
      settings.whatsapp_thanks_hours_after,
    );
    await upsertOutbox(sb, row, "thanks", sendAt);
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

  const ready = await ensureWhatsappReadyForDispatch(sb, row.restaurant_id);
  if (ready !== "ok") {
    return { ok: true, skipped: ready };
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
  limit = 20,
  budgetMs = 100_000,
): Promise<{ processed: number; sent: number; failed: number; timedOut?: boolean }> {
  // Atomarer Claim (SKIP LOCKED) — parallele Cron/Retries sehen dieselben Zeilen nicht.
  const { data: due, error } = await sb.rpc("claim_reservation_whatsapp_outbox", {
    p_limit: limit,
  });

  if (error || !due?.length) {
    if (error) {
      console.warn(
        "[reservation-whatsapp-outbox] claim failed",
        error.message,
      );
    }
    return { processed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  let timedOut = false;
  const deadline = Date.now() + budgetMs;
  const settingsByRestaurant = new Map<string, ReservationWhatsappSettings | null>();
  const timezoneByRestaurant = new Map<string, string>();

  for (const item of due as Array<{
    id: string;
    reservation_id: string;
    message_kind: string;
    send_at?: string;
  }>) {
    if (Date.now() >= deadline) {
      timedOut = true;
      // Unprocessed claims freigeben, damit der nächste Cron sie neu claimen kann.
      await sb
        .from("reservation_whatsapp_outbox")
        .update({ claimed_at: null })
        .eq("id", item.id)
        .is("sent_at", null);
      continue;
    }
    const row = await fetchReservationForWhatsapp(sb, item.reservation_id);
    if (!row || !row.notify_whatsapp) {
      await sb
        .from("reservation_whatsapp_outbox")
        .update({
          cancelled_at: new Date().toISOString(),
          last_error: "reservation_ineligible",
          claimed_at: null,
        })
        .eq("id", item.id);
      continue;
    }

    const kind = item.message_kind as OutboxKind;
    if (kind !== "reminder" && kind !== "thanks") {
      await sb
        .from("reservation_whatsapp_outbox")
        .update({ claimed_at: null })
        .eq("id", item.id);
      continue;
    }

    if (TERMINAL_STATUS.has(row.status_code)) {
      await sb
        .from("reservation_whatsapp_outbox")
        .update({
          cancelled_at: new Date().toISOString(),
          claimed_at: null,
        })
        .eq("id", item.id);
      continue;
    }

    if (
      (kind === "reminder" && isReservationReminderTooLate(row.starts_at)) ||
      (item.send_at && isReservationOutboxSendAtTooStale(item.send_at))
    ) {
      await sb
        .from("reservation_whatsapp_outbox")
        .update({
          cancelled_at: new Date().toISOString(),
          last_error: "too_late",
          claimed_at: null,
        })
        .eq("id", item.id);
      continue;
    }

    const ready = await ensureWhatsappReadyForDispatch(sb, row.restaurant_id);
    if (ready !== "ok") {
      await sb
        .from("reservation_whatsapp_outbox")
        .update({ last_error: ready, claimed_at: null })
        .eq("id", item.id);
      failed++;
      continue;
    }

    const chatId = guestPhoneToWhatsAppChatId(row.guest_phone);
    if (!chatId) {
      await sb
        .from("reservation_whatsapp_outbox")
        .update({
          last_error: "no_phone",
          cancelled_at: new Date().toISOString(),
          claimed_at: null,
        })
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
        .update({
          cancelled_at: new Date().toISOString(),
          claimed_at: null,
        })
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
        .update({
          sent_at: new Date().toISOString(),
          last_error: null,
          // claimed_at bleibt gesetzt — Audit, dass Claim → Send gelaufen ist
        })
        .eq("id", item.id);
      sent++;
    } else {
      await sb
        .from("reservation_whatsapp_outbox")
        .update({ last_error: result.error, claimed_at: null })
        .eq("id", item.id);
      failed++;
    }
  }

  return { processed: due.length, sent, failed, timedOut: timedOut || undefined };
}
