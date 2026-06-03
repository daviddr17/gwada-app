import { buildGuestManageUrl } from "@/lib/reservations/guest-manage-url";
import {
  buildEmailMessage,
  buildEmailSubject,
  resolveEmailSenderDisplayName,
  type WhatsappImmediateKind,
  type WhatsappMessageKind,
} from "@/lib/whatsapp/reservation-whatsapp-message-config";
import type { ReservationMessageContext } from "@/lib/whatsapp/reservation-message-templates";
import { sendReservationEmail } from "@/lib/email/send-reservation-email";
import { appendReviewRequestToMessage } from "@/lib/reviews/review-request-append-server";
import { isEmailSendConfigured } from "@/lib/email/is-email-send-configured";
import { smtpCredentialsFromConfig } from "@/lib/integrations/smtp-integration-config";
import {
  resolveEmailSender,
  type EmailSender,
  type EmailSmtpCredentials,
} from "@/lib/email/email-delivery";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { RESERVATION_STATUS_EMBED } from "@/lib/supabase/reservations-db";
import { fetchPlatformEmailSmtpConfigAdmin } from "@/lib/supabase/platform-email-secrets-db";
import { fetchRestaurantEmailSmtpConfig } from "@/lib/supabase/restaurant-email-integration-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ReservationEmailSettings = {
  email_received_enabled: boolean;
  email_confirmed_enabled: boolean;
  email_reminder_enabled: boolean;
  email_reminder_hours_before: number;
  email_thanks_enabled: boolean;
  email_thanks_hours_after: number;
  email_cancelled_enabled: boolean;
  email_declined_enabled: boolean;
  email_no_show_enabled: boolean;
  guest_manage_url_template: string | null;
  email_received_template: string | null;
  email_confirmed_template: string | null;
  email_reminder_template: string | null;
  email_thanks_template: string | null;
  email_cancelled_template: string | null;
  email_declined_template: string | null;
  email_no_show_template: string | null;
  email_sender_name: string | null;
  email_received_subject: string | null;
  email_confirmed_subject: string | null;
  email_reminder_subject: string | null;
  email_thanks_subject: string | null;
  email_cancelled_subject: string | null;
  email_declined_subject: string | null;
  email_no_show_subject: string | null;
};

export type ReservationForEmail = {
  id: string;
  restaurant_id: string;
  reservation_number: number;
  guest_pin: string;
  guest_first_name: string;
  guest_last_name: string;
  guest_email: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  notify_email: boolean;
  status_code: string;
};

export type OutboxKind = WhatsappMessageKind;

const SCHEDULED_KINDS: OutboxKind[] = ["reminder", "thanks"];

function isValidGuestEmail(email: string | null): boolean {
  const e = email?.trim();
  return !!e && e.includes("@");
}

export function isEmailKindEnabled(
  settings: ReservationEmailSettings,
  kind: WhatsappMessageKind,
): boolean {
  switch (kind) {
    case "received":
      return settings.email_received_enabled;
    case "confirmed":
      return settings.email_confirmed_enabled;
    case "reminder":
      return settings.email_reminder_enabled;
    case "thanks":
      return settings.email_thanks_enabled;
    case "cancelled":
      return settings.email_cancelled_enabled;
    case "declined":
      return settings.email_declined_enabled;
    case "no_show":
      return settings.email_no_show_enabled;
  }
}

async function fetchRestaurantName(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<string | null> {
  const { data, error } = await sb
    .from("restaurants")
    .select("name")
    .eq("id", restaurantId)
    .maybeSingle();
  if (error || !data) return null;
  const name = data.name;
  return typeof name === "string" ? name.trim() || null : null;
}

type EmailDelivery = { sender: EmailSender; smtp: EmailSmtpCredentials } | null;

/**
 * SMTP inkl. Passwort nur per Service-Role. Plattform-Fallback nicht für Nutzer lesbar.
 */
export async function resolveEmailDeliveryForRestaurant(
  restaurantId: string,
  sbForName?: SupabaseClient,
): Promise<EmailDelivery> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;

  const nameClient = sbForName ?? admin;
  const [integration, restaurantName, platformEmail] = await Promise.all([
    fetchRestaurantEmailSmtpConfig(admin, restaurantId),
    fetchRestaurantName(nameClient, restaurantId),
    fetchPlatformEmailSmtpConfigAdmin(),
  ]);

  const useCustom = integration?.status === "custom";

  if (useCustom) {
    const smtpRaw = smtpCredentialsFromConfig(integration?.config ?? {});
    if (!smtpRaw) return null;
    const sender = resolveEmailSender({
      useCustom: true,
      fromEmail: smtpRaw.email,
      fromName: integration?.config.from_name,
      restaurantFallbackName: restaurantName,
    });
    return { sender, smtp: smtpRaw };
  }

  if (!platformEmail?.enabled) return null;

  const smtpRaw = smtpCredentialsFromConfig(platformEmail.config);
  if (!smtpRaw) return null;

  const sender = resolveEmailSender({
    useCustom: false,
    fromEmail: smtpRaw.email,
    fromName: platformEmail.config.from_name,
  });
  return { sender, smtp: smtpRaw };
}

export async function fetchReservationForEmail(
  sb: SupabaseClient,
  reservationId: string,
): Promise<ReservationForEmail | null> {
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
      guest_email,
      party_size,
      starts_at,
      ends_at,
      notify_email,
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
    guest_email: data.guest_email as string | null,
    party_size: data.party_size as number,
    starts_at: data.starts_at as string,
    ends_at: data.ends_at as string,
    notify_email: Boolean(data.notify_email),
    status_code: status?.code ?? "pending",
  };
}

const SETTINGS_SELECT = [
  "email_received_enabled",
  "email_confirmed_enabled",
  "email_reminder_enabled",
  "email_reminder_hours_before",
  "email_thanks_enabled",
  "email_thanks_hours_after",
  "email_cancelled_enabled",
  "email_declined_enabled",
  "email_no_show_enabled",
  "guest_manage_url_template",
  "email_received_template",
  "email_confirmed_template",
  "email_reminder_template",
  "email_thanks_template",
  "email_cancelled_template",
  "email_declined_template",
  "email_no_show_template",
  "email_sender_name",
  "email_received_subject",
  "email_confirmed_subject",
  "email_reminder_subject",
  "email_thanks_subject",
  "email_cancelled_subject",
  "email_declined_subject",
  "email_no_show_subject",
].join(", ");

export async function fetchReservationEmailSettings(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<ReservationEmailSettings | null> {
  const { data, error } = await sb
    .from("restaurant_reservation_settings")
    .select(SETTINGS_SELECT)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as ReservationEmailSettings;
}

function messageContext(
  row: ReservationForEmail,
  settings: ReservationEmailSettings | null,
): ReservationMessageContext {
  return {
    guestFirstName: row.guest_first_name,
    guestLastName: row.guest_last_name,
    partySize: row.party_size,
    startsAt: new Date(row.starts_at),
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
  row: ReservationForEmail,
  settings: ReservationEmailSettings | null,
): string {
  return buildEmailMessage(settings, kind, messageContext(row, settings));
}

async function upsertOutbox(
  sb: SupabaseClient,
  row: ReservationForEmail,
  kind: OutboxKind,
  sendAt: Date,
): Promise<void> {
  await sb.from("reservation_email_outbox").upsert(
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
    .from("reservation_email_outbox")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("reservation_id", reservationId)
    .in("message_kind", kinds)
    .is("sent_at", null);
}

export async function sendImmediateKind(
  sb: SupabaseClient,
  row: ReservationForEmail,
  kind: WhatsappImmediateKind,
  settings: ReservationEmailSettings | null,
): Promise<{ sent: boolean; error?: string }> {
  const to = row.guest_email?.trim();
  if (!isValidGuestEmail(to ?? null)) return { sent: false, error: "no_email" };

  const ctx = messageContext(row, settings);
  const text = buildText(kind, row, settings);
  const subject = buildEmailSubject(settings, kind, ctx);
  const delivery = await resolveEmailDeliveryForRestaurant(
    row.restaurant_id,
    sb,
  );
  if (!delivery) return { sent: false, error: "smtp_not_configured" };

  const fromName = resolveEmailSenderDisplayName(settings, delivery.sender.name);
  const result = await sendReservationEmail(
    { ...delivery, sender: { ...delivery.sender, name: fromName } },
    { to: to!, subject, text },
  );

  if (!result.ok) {
    await sb.from("reservation_email_outbox").upsert(
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

  await sb.from("reservation_email_outbox").upsert(
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
  return { sent: true };
}

export async function scheduleTimedMessages(
  sb: SupabaseClient,
  row: ReservationForEmail,
  settings: ReservationEmailSettings,
): Promise<void> {
  const terminal = ["cancelled", "declined", "no_show"].includes(row.status_code);
  if (terminal) {
    await cancelOutboxKinds(sb, row.id, SCHEDULED_KINDS);
    return;
  }

  const starts = new Date(row.starts_at);
  const ends = new Date(row.ends_at);

  if (settings.email_reminder_enabled && settings.email_reminder_hours_before > 0) {
    const sendAt = new Date(
      starts.getTime() - settings.email_reminder_hours_before * 60 * 60 * 1000,
    );
    if (sendAt.getTime() > Date.now()) {
      await upsertOutbox(sb, row, "reminder", sendAt);
    } else {
      await cancelOutboxKinds(sb, row.id, ["reminder"]);
    }
  } else {
    await cancelOutboxKinds(sb, row.id, ["reminder"]);
  }

  if (settings.email_thanks_enabled && settings.email_thanks_hours_after > 0) {
    const sendAt = new Date(
      ends.getTime() + settings.email_thanks_hours_after * 60 * 60 * 1000,
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
  | "no_show";

const EVENT_TO_KIND: Record<
  Exclude<DispatchEvent, "created">,
  WhatsappImmediateKind
> = {
  confirmed: "confirmed",
  cancelled: "cancelled",
  declined: "declined",
  no_show: "no_show",
};

async function sendForEvent(
  sb: SupabaseClient,
  row: ReservationForEmail,
  settings: ReservationEmailSettings,
  kind: WhatsappImmediateKind,
): Promise<{ ok: boolean; skipped?: string; error?: string }> {
  if (!isEmailKindEnabled(settings, kind)) {
    return { ok: true, skipped: "disabled" };
  }
  if (["cancelled", "declined", "no_show"].includes(kind)) {
    await cancelOutboxKinds(sb, row.id, SCHEDULED_KINDS);
  }
  const send = await sendImmediateKind(sb, row, kind, settings);
  if (!send.sent) {
    return { ok: false, error: send.error ?? "send_failed" };
  }
  return { ok: true };
}

export async function dispatchReservationEmail(
  sb: SupabaseClient,
  reservationId: string,
  event: DispatchEvent,
): Promise<{ ok: boolean; skipped?: string; error?: string }> {
  const row = await fetchReservationForEmail(sb, reservationId);
  if (!row) return { ok: false, error: "reservation_not_found" };
  if (!row.notify_email) return { ok: true, skipped: "notify_email_off" };

  if (!isEmailSendConfigured()) {
    return { ok: true, skipped: "email_send_not_configured" };
  }

  const settings = await fetchReservationEmailSettings(sb, row.restaurant_id);
  if (!settings) return { ok: true, skipped: "no_settings" };

  if (event === "created") {
    if (row.status_code === "pending") {
      const r = await sendForEvent(sb, row, settings, "received");
      if (!r.ok) return r;
    } else if (row.status_code === "confirmed") {
      const r = await sendForEvent(sb, row, settings, "confirmed");
      if (!r.ok) return r;
    } else if (row.status_code === "cancelled") {
      const r = await sendForEvent(sb, row, settings, "cancelled");
      if (!r.ok) return r;
    } else if (row.status_code === "declined") {
      const r = await sendForEvent(sb, row, settings, "declined");
      if (!r.ok) return r;
    } else if (row.status_code === "no_show") {
      const r = await sendForEvent(sb, row, settings, "no_show");
      if (!r.ok) return r;
    }
    await scheduleTimedMessages(sb, row, settings);
    return { ok: true };
  }

  const kind = EVENT_TO_KIND[event];
  const result = await sendForEvent(sb, row, settings, kind);
  if (!result.ok) return result;
  if (event === "confirmed") {
    await scheduleTimedMessages(sb, row, settings);
  }
  return { ok: true };
}

const TERMINAL_STATUS = new Set(["cancelled", "declined", "no_show"]);

export async function processDueEmailOutbox(
  sb: SupabaseClient,
  limit = 50,
): Promise<{ processed: number; sent: number; failed: number }> {
  const { data: due, error } = await sb
    .from("reservation_email_outbox")
    .select("id, reservation_id, message_kind")
    .is("sent_at", null)
    .is("cancelled_at", null)
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true })
    .limit(limit);

  if (error || !due?.length) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  if (!isEmailSendConfigured()) {
    for (const item of due) {
      await sb
        .from("reservation_email_outbox")
        .update({ last_error: "email_send_not_configured" })
        .eq("id", item.id);
    }
    return { processed: due.length, sent: 0, failed: due.length };
  }

  let sent = 0;
  let failed = 0;
  const settingsByRestaurant = new Map<string, ReservationEmailSettings | null>();
  const deliveryByRestaurant = new Map<string, EmailDelivery>();

  for (const item of due) {
    const row = await fetchReservationForEmail(sb, item.reservation_id as string);
    if (!row || !row.notify_email) {
      await sb
        .from("reservation_email_outbox")
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
        .from("reservation_email_outbox")
        .update({ cancelled_at: new Date().toISOString() })
        .eq("id", item.id);
      continue;
    }

    const to = row.guest_email?.trim();
    if (!isValidGuestEmail(to ?? null)) {
      await sb
        .from("reservation_email_outbox")
        .update({ last_error: "no_email", cancelled_at: new Date().toISOString() })
        .eq("id", item.id);
      failed++;
      continue;
    }

    let settings = settingsByRestaurant.get(row.restaurant_id);
    if (settings === undefined) {
      settings = await fetchReservationEmailSettings(sb, row.restaurant_id);
      settingsByRestaurant.set(row.restaurant_id, settings);
    }

    if (!settings || !isEmailKindEnabled(settings, kind)) {
      await sb
        .from("reservation_email_outbox")
        .update({ cancelled_at: new Date().toISOString() })
        .eq("id", item.id);
      continue;
    }

    let delivery = deliveryByRestaurant.get(row.restaurant_id);
    if (delivery === undefined) {
      delivery = await resolveEmailDeliveryForRestaurant(row.restaurant_id, sb);
      deliveryByRestaurant.set(row.restaurant_id, delivery);
    }
    if (!delivery) {
      await sb
        .from("reservation_email_outbox")
        .update({ last_error: "smtp_not_configured" })
        .eq("id", item.id);
      failed++;
      continue;
    }

    const ctx = messageContext(row, settings);
    let text = buildText(kind, row, settings);
    if (kind === "thanks") {
      text = await appendReviewRequestToMessage(sb, {
        restaurantId: row.restaurant_id,
        reservationId: row.id,
        text,
      });
    }
    const subject = buildEmailSubject(settings, kind, ctx);
    const fromName = resolveEmailSenderDisplayName(
      settings,
      delivery.sender.name,
    );
    const result = await sendReservationEmail(
      { ...delivery, sender: { ...delivery.sender, name: fromName } },
      { to: to!, subject, text },
    );

    if (result.ok) {
      await sb
        .from("reservation_email_outbox")
        .update({ sent_at: new Date().toISOString(), last_error: null })
        .eq("id", item.id);
      sent++;
    } else {
      await sb
        .from("reservation_email_outbox")
        .update({ last_error: result.error })
        .eq("id", item.id);
      failed++;
    }
  }

  return { processed: due.length, sent, failed };
}
