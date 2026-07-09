import "server-only";

import { defaultWeeklyHours } from "@/lib/constants/restaurant-profile";
import {
  isStartPublicBookable,
  isStartsAtWithinBookingLeadTime,
  normalizeBookingLeadTimeHours,
} from "@/lib/reservations/embed-booking-datetime";
import {
  normalizeMinMinutesBeforeClosing,
  publicCountries,
  type PublicEmbedRestaurant,
  type PublicGuestReservation,
  type PublicReservationCreateBody,
  type PublicReservationUpdateBody,
} from "@/lib/reservations/public-embed-shared";
import {
  normalizeReservationGuestFirstName,
  normalizeReservationGuestLastName,
} from "@/lib/reservations/reservation-guest-name";
import type { ReservationPendingChange } from "@/lib/reservations/reservation-pending-change";
import {
  buildReservationLogChanges,
  buildReservationLogDetails,
  reservationSnapshotFromPayload,
} from "@/lib/reservations/reservation-log-build";
import { insertReservationLogEntry } from "@/lib/reservations/reservation-log-insert";
import { dispatchReservationEmail } from "@/lib/reservations/reservation-email-dispatch";
import { dispatchReservationWhatsapp } from "@/lib/reservations/reservation-whatsapp-dispatch";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { RESERVATION_STATUS_EMBED } from "@/lib/supabase/reservations-db";
import type {
  DateHoursException,
  DayHours,
  Weekday,
} from "@/lib/types/restaurant";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatReservationGuestLabel,
} from "@/lib/types/reservation-log";

export type {
  PublicEmbedRestaurant,
  PublicGuestReservation,
  PublicReservationCreateBody,
  PublicReservationUpdateBody,
} from "@/lib/reservations/public-embed-shared";
export { publicCountries } from "@/lib/reservations/public-embed-shared";
export {
  isStartPublicBookable,
  isStartsAtWithinBookingLeadTime,
} from "@/lib/reservations/embed-booking-datetime";

function adminOrError(): SupabaseClient | { error: string; status: number } {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured", status: 503 };
  return admin;
}

function timeToHHmm(t: string | null | undefined): string | undefined {
  if (!t) return undefined;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return undefined;
  return `${m[1]!.padStart(2, "0")}:${m[2]}`;
}

export async function loadOpeningHoursAdmin(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{
  weeklyHours: Record<Weekday, DayHours>;
  dateExceptions: DateHoursException[];
}> {
  const weeklyHours = defaultWeeklyHours() as Record<Weekday, DayHours>;
  const dateExceptions: DateHoursException[] = [];
  const { data, error } = await admin
    .from("opening_hours")
    .select(
      "kind,weekday,exception_date,closed,opens_at,closes_at",
    )
    .eq("restaurant_id", restaurantId);
  if (error) {
    console.warn("[gwada] embed opening_hours", error.message);
    return { weeklyHours, dateExceptions };
  }
  for (const raw of data ?? []) {
    const row = raw as {
      kind: string;
      weekday: Weekday | null;
      exception_date: string | null;
      closed: boolean;
      opens_at: string | null;
      closes_at: string | null;
    };
    if (row.kind === "weekly" && row.weekday) {
      weeklyHours[row.weekday] = {
        closed: row.closed,
        open: row.closed ? undefined : timeToHHmm(row.opens_at),
        close: row.closed ? undefined : timeToHHmm(row.closes_at),
      };
    } else if (row.kind === "exception" && row.exception_date) {
      dateExceptions.push({
        id: row.exception_date,
        date: row.exception_date,
        closed: row.closed,
        open: row.closed ? undefined : timeToHHmm(row.opens_at),
        close: row.closed ? undefined : timeToHHmm(row.closes_at),
      });
    }
  }
  return { weeklyHours, dateExceptions };
}

export async function fetchPublicEmbedRestaurant(
  slugInput: string,
): Promise<
  | { data: PublicEmbedRestaurant; error: null }
  | { data: null; error: string; status: number }
> {
  const admin = adminOrError();
  if ("error" in admin) {
    return { data: null, error: admin.error, status: admin.status };
  }

  const slug = normalizeRestaurantSlugInput(slugInput);
  if (!slug) {
    return { data: null, error: "invalid_slug", status: 400 };
  }

  const { data: row, error } = await admin
    .from("restaurants")
    .select("id, name, slug, brand_accent_hex, is_published")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return { data: null, error: "db_error", status: 500 };
  }
  if (!row?.id || !row.is_published) {
    return { data: null, error: "not_found", status: 404 };
  }

  const [{ weeklyHours, dateExceptions }, settingsRes] = await Promise.all([
    loadOpeningHoursAdmin(admin, row.id),
    admin
      .from("restaurant_reservation_settings")
      .select(
        "default_dwell_minutes, booking_lead_time_hours, min_minutes_before_closing, embed_form_footer_text",
      )
      .eq("restaurant_id", row.id)
      .maybeSingle(),
  ]);

  const accentHex =
    normalizeHex(String(row.brand_accent_hex ?? "")) ?? DEFAULT_ACCENT_HEX;
  const defaultDwell = settingsRes.data?.default_dwell_minutes;
  const defaultDwellMinutes =
    typeof defaultDwell === "number" && defaultDwell >= 15 && defaultDwell <= 1440
      ? defaultDwell
      : 120;
  const bookingLeadTimeHours = normalizeBookingLeadTimeHours(
    Number(settingsRes.data?.booking_lead_time_hours),
  );
  const minMinutesBeforeClosing = normalizeMinMinutesBeforeClosing(
    settingsRes.data?.min_minutes_before_closing,
  );
  const footerRaw = settingsRes.data?.embed_form_footer_text;
  const embedFormFooterText =
    typeof footerRaw === "string" && footerRaw.trim() ? footerRaw.trim() : null;

  return {
    data: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      accentHex,
      defaultDwellMinutes,
      bookingLeadTimeHours,
      minMinutesBeforeClosing,
      embedFormFooterText,
      weeklyHours,
      dateExceptions,
    },
    error: null,
  };
}

async function pendingStatusId(admin: SupabaseClient): Promise<string | null> {
  const { data } = await admin
    .from("reservation_statuses")
    .select("id")
    .eq("code", "pending")
    .maybeSingle();
  return data?.id ?? null;
}

async function verifyGuestPin(
  admin: SupabaseClient,
  restaurantId: string,
  reservationNumber: number,
  pin: string,
): Promise<string | null> {
  const { data, error } = await admin.rpc("verify_reservation_guest_pin", {
    p_restaurant_id: restaurantId,
    p_reservation_number: reservationNumber,
    p_pin: pin.trim(),
  });
  if (error) {
    console.warn("[gwada] verify_reservation_guest_pin", error.message);
    return null;
  }
  return typeof data === "string" ? data : null;
}

function honeypotFilled(website: string | undefined): boolean {
  return Boolean(website?.trim());
}

function validatePartySize(n: number): boolean {
  return Number.isFinite(n) && n >= 1 && n <= 30;
}

function validateIsoRange(startsAt: string, endsAt: string): boolean {
  const s = new Date(startsAt).getTime();
  const e = new Date(endsAt).getTime();
  return Number.isFinite(s) && Number.isFinite(e) && e > s;
}

function hasGuestContact(phone: string | null, email: string | null): boolean {
  return Boolean(phone?.trim()) || Boolean(email?.trim());
}

function hasNotifyChannel(notifyEmail: boolean, notifyWhatsapp: boolean): boolean {
  return notifyEmail || notifyWhatsapp;
}

async function changeRequestedStatusId(
  admin: SupabaseClient,
): Promise<string | null> {
  const { data } = await admin
    .from("reservation_statuses")
    .select("id")
    .eq("code", "change_requested")
    .maybeSingle();
  return data?.id ?? null;
}

async function dispatchGuestNotifications(reservationId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  void dispatchReservationWhatsapp(admin, reservationId, "created").catch((e) => {
    console.warn("[gwada] embed whatsapp dispatch", e);
  });
  void dispatchReservationEmail(admin, reservationId, "created").catch((e) => {
    console.warn("[gwada] embed email dispatch", e);
  });
}

export async function createPublicReservation(
  body: PublicReservationCreateBody,
): Promise<
  | {
      data: {
        reservation_number: number;
        guest_pin: string;
      };
      error: null;
    }
  | { data: null; error: string; status: number }
> {
  if (honeypotFilled(body.website)) {
    return { data: null, error: "invalid_request", status: 400 };
  }
  if (!body.terms_accepted) {
    return { data: null, error: "terms_required", status: 400 };
  }
  if (!validatePartySize(body.party_size) || !validateIsoRange(body.starts_at, body.ends_at)) {
    return { data: null, error: "invalid_request", status: 400 };
  }
  if (!normalizeReservationGuestLastName(body.guest_last_name)) {
    return { data: null, error: "last_name_required", status: 400 };
  }
  if (!hasGuestContact(body.guest_phone, body.guest_email)) {
    return { data: null, error: "contact_required", status: 400 };
  }
  if (!hasNotifyChannel(body.notify_email, body.notify_whatsapp)) {
    return { data: null, error: "notify_channel_required", status: 400 };
  }

  const restaurantRes = await fetchPublicEmbedRestaurant(body.slug);
  if (restaurantRes.error || !restaurantRes.data) {
    return {
      data: null,
      error: restaurantRes.error ?? "not_found",
      status: restaurantRes.status ?? 404,
    };
  }
  const restaurant = restaurantRes.data;

  if (
    !isStartsAtWithinBookingLeadTime(
      body.starts_at,
      restaurant.bookingLeadTimeHours,
    )
  ) {
    return { data: null, error: "booking_lead_time", status: 400 };
  }
  if (!isStartPublicBookable(restaurant, body.starts_at)) {
    return { data: null, error: "outside_opening_hours", status: 400 };
  }

  const admin = adminOrError();
  if ("error" in admin) {
    return { data: null, error: admin.error, status: admin.status };
  }

  const statusId = await pendingStatusId(admin);
  if (!statusId) {
    return { data: null, error: "server_misconfigured", status: 503 };
  }

  const dwell =
    Math.round(
      (new Date(body.ends_at).getTime() - new Date(body.starts_at).getTime()) /
        60_000,
    ) || restaurant.defaultDwellMinutes;

  const { data, error } = await admin
    .from("reservations")
    .insert({
      restaurant_id: restaurant.id,
      guest_first_name: normalizeReservationGuestFirstName(body.guest_first_name),
      guest_last_name: normalizeReservationGuestLastName(body.guest_last_name),
      guest_phone: body.guest_phone?.trim() || null,
      guest_email: body.guest_email?.trim() || null,
      party_size: body.party_size,
      starts_at: body.starts_at,
      ends_at: body.ends_at,
      status_id: statusId,
      dining_table_id: null,
      dwell_minutes: dwell,
      notify_email: body.notify_email,
      notify_whatsapp: body.notify_whatsapp,
      terms_accepted: body.terms_accepted,
    })
    .select("id, reservation_number, guest_pin")
    .single();

  if (error || !data?.id) {
    console.warn("[gwada] public reservation insert", error?.message);
    return { data: null, error: "create_failed", status: 500 };
  }

  const guestFirst = normalizeReservationGuestFirstName(body.guest_first_name);
  const guestLast = normalizeReservationGuestLastName(body.guest_last_name);
  const after = reservationSnapshotFromPayload(
    {
      guest_first_name: guestFirst,
      guest_last_name: guestLast,
      guest_phone: body.guest_phone?.trim() || null,
      guest_email: body.guest_email?.trim() || null,
      party_size: body.party_size,
      starts_at: body.starts_at,
      ends_at: body.ends_at,
      status_id: statusId,
      dining_table_id: null,
      dwell_minutes: dwell,
      notify_email: body.notify_email,
      notify_whatsapp: body.notify_whatsapp,
      terms_accepted: body.terms_accepted,
    },
    "Offen",
    "Kein Tisch",
  );
  await insertReservationLogEntry(admin, {
    restaurantId: restaurant.id,
    reservationId: data.id as string,
    actorUserId: null,
    action: "created",
    reservationNumber: data.reservation_number as number,
    guestLabel: formatReservationGuestLabel(
      data.reservation_number as number,
      guestFirst,
      guestLast,
    ),
    details: buildReservationLogDetails(
      buildReservationLogChanges(null, after),
      { actorSource: "guest", summary: "Online gebucht" },
    ),
  });

  await dispatchGuestNotifications(data.id);

  return {
    data: {
      reservation_number: data.reservation_number,
      guest_pin: data.guest_pin,
    },
    error: null,
  };
}

export async function loadPublicReservationForManage(
  slug: string,
  reservationNumber: number,
  pin: string,
): Promise<
  | { data: PublicGuestReservation; error: null }
  | { data: null; error: string; status: number }
> {
  const restaurantRes = await fetchPublicEmbedRestaurant(slug);
  if (restaurantRes.error || !restaurantRes.data) {
    return {
      data: null,
      error: restaurantRes.error ?? "not_found",
      status: restaurantRes.status ?? 404,
    };
  }

  const admin = adminOrError();
  if ("error" in admin) {
    return { data: null, error: admin.error, status: admin.status };
  }

  const reservationId = await verifyGuestPin(
    admin,
    restaurantRes.data.id,
    reservationNumber,
    pin,
  );
  if (!reservationId) {
    return { data: null, error: "invalid_credentials", status: 401 };
  }

  const { data, error } = await admin
    .from("reservations")
    .select(
      `
      id,
      reservation_number,
      guest_first_name,
      guest_last_name,
      guest_phone,
      guest_email,
      party_size,
      starts_at,
      ends_at,
      dwell_minutes,
      dining_table_id,
      notify_email,
      notify_whatsapp,
      terms_accepted,
      ${RESERVATION_STATUS_EMBED} ( code )
    `,
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (error || !data) {
    return { data: null, error: "not_found", status: 404 };
  }

  const statusRaw = data.reservation_statuses as
    | { code: string }
    | { code: string }[]
    | null;
  const statusJoin = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
  return {
    data: {
      id: data.id,
      reservation_number: data.reservation_number,
      guest_first_name: data.guest_first_name,
      guest_last_name: data.guest_last_name,
      guest_phone: data.guest_phone,
      guest_email: data.guest_email,
      party_size: data.party_size,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      dwell_minutes: data.dwell_minutes,
      notify_email: data.notify_email,
      notify_whatsapp: data.notify_whatsapp,
      terms_accepted: data.terms_accepted,
      status_code: statusJoin?.code ?? "pending",
      dining_table_id: data.dining_table_id ?? null,
    },
    error: null,
  };
}

export async function updatePublicReservation(
  body: PublicReservationUpdateBody,
): Promise<
  | { data: { ok: true; change_request: boolean }; error: null }
  | { data: null; error: string; status: number }
> {
  if (honeypotFilled(body.website)) {
    return { data: null, error: "invalid_request", status: 400 };
  }
  if (!body.terms_accepted) {
    return { data: null, error: "terms_required", status: 400 };
  }
  if (!validatePartySize(body.party_size) || !validateIsoRange(body.starts_at, body.ends_at)) {
    return { data: null, error: "invalid_request", status: 400 };
  }
  if (!normalizeReservationGuestLastName(body.guest_last_name)) {
    return { data: null, error: "last_name_required", status: 400 };
  }
  if (!hasGuestContact(body.guest_phone, body.guest_email)) {
    return { data: null, error: "contact_required", status: 400 };
  }
  if (!hasNotifyChannel(body.notify_email, body.notify_whatsapp)) {
    return { data: null, error: "notify_channel_required", status: 400 };
  }

  const loadRes = await loadPublicReservationForManage(
    body.slug,
    body.reservation_number,
    body.pin,
  );
  if (loadRes.error || !loadRes.data) {
    return {
      data: null,
      error: loadRes.error ?? "invalid_credentials",
      status: loadRes.status ?? 401,
    };
  }
  const existing = loadRes.data;

  if (["cancelled", "declined", "no_show"].includes(existing.status_code)) {
    return { data: null, error: "not_editable", status: 403 };
  }

  const restaurantRes = await fetchPublicEmbedRestaurant(body.slug);
  if (restaurantRes.error || !restaurantRes.data) {
    return {
      data: null,
      error: restaurantRes.error ?? "not_found",
      status: restaurantRes.status ?? 404,
    };
  }
  const startsChanged =
    new Date(body.starts_at).getTime() !== new Date(existing.starts_at).getTime();
  if (startsChanged) {
    if (
      !isStartsAtWithinBookingLeadTime(
        body.starts_at,
        restaurantRes.data.bookingLeadTimeHours,
      )
    ) {
      return { data: null, error: "booking_lead_time", status: 400 };
    }
    if (!isStartPublicBookable(restaurantRes.data, body.starts_at)) {
      return { data: null, error: "outside_opening_hours", status: 400 };
    }
  }

  const admin = adminOrError();
  if ("error" in admin) {
    return { data: null, error: admin.error, status: admin.status };
  }

  const dwell =
    Math.round(
      (new Date(body.ends_at).getTime() - new Date(body.starts_at).getTime()) /
        60_000,
    ) || existing.dwell_minutes;

  const patch = {
    guest_first_name: normalizeReservationGuestFirstName(body.guest_first_name),
    guest_last_name: normalizeReservationGuestLastName(body.guest_last_name),
    guest_phone: body.guest_phone?.trim() || null,
    guest_email: body.guest_email?.trim() || null,
    party_size: body.party_size,
    starts_at: body.starts_at,
    ends_at: body.ends_at,
    dwell_minutes: dwell,
    notify_email: body.notify_email,
    notify_whatsapp: body.notify_whatsapp,
    terms_accepted: body.terms_accepted,
  };

  if (existing.status_code === "pending") {
    const { error } = await admin
      .from("reservations")
      .update(patch)
      .eq("id", existing.id);
    if (error) {
      console.warn("[gwada] public reservation update", error.message);
      return { data: null, error: "update_failed", status: 500 };
    }
    const before = reservationSnapshotFromPayload(
      {
        guest_first_name: existing.guest_first_name,
        guest_last_name: existing.guest_last_name,
        guest_phone: existing.guest_phone,
        guest_email: existing.guest_email,
        party_size: existing.party_size,
        starts_at: existing.starts_at,
        ends_at: existing.ends_at,
        status_id: "",
        dining_table_id: existing.dining_table_id,
        dwell_minutes: existing.dwell_minutes,
        notify_email: existing.notify_email,
        notify_whatsapp: existing.notify_whatsapp,
        terms_accepted: existing.terms_accepted,
      },
      existing.status_code,
      "Kein Tisch",
    );
    const after = reservationSnapshotFromPayload(
      { ...patch, status_id: "", dining_table_id: existing.dining_table_id },
      existing.status_code,
      "Kein Tisch",
    );
    await insertReservationLogEntry(admin, {
      restaurantId: restaurantRes.data.id,
      reservationId: existing.id,
      actorUserId: null,
      action: "updated",
      reservationNumber: existing.reservation_number,
      guestLabel: formatReservationGuestLabel(
        existing.reservation_number,
        patch.guest_first_name,
        patch.guest_last_name,
      ),
      details: buildReservationLogDetails(
        buildReservationLogChanges(before, after),
        { actorSource: "guest" },
      ),
    });
    if (body.notify_email || body.notify_whatsapp) {
      await dispatchGuestNotifications(existing.id);
    }
    return { data: { ok: true, change_request: false }, error: null };
  }

  const changeStatusId = await changeRequestedStatusId(admin);
  if (!changeStatusId) {
    return { data: null, error: "server_misconfigured", status: 503 };
  }

  const { data: currentRow } = await admin
    .from("reservations")
    .select(`status_id, status_before_change_id, ${RESERVATION_STATUS_EMBED} ( code )`)
    .eq("id", existing.id)
    .maybeSingle();

  const currentStatusId = currentRow?.status_id as string | undefined;
  const statusRaw = currentRow?.reservation_statuses as
    | { code: string }
    | { code: string }[]
    | null
    | undefined;
  const currentCode = Array.isArray(statusRaw)
    ? statusRaw[0]?.code
    : statusRaw?.code;
  const isAlreadyChange = currentCode === "change_requested";

  const pendingChange: ReservationPendingChange = {
    ...patch,
    requested_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("reservations")
    .update({
      pending_change: pendingChange,
      status_id: changeStatusId,
      status_before_change_id: isAlreadyChange
        ? (currentRow?.status_before_change_id as string | null)
        : currentStatusId ?? null,
    })
    .eq("id", existing.id);

  if (error) {
    console.warn("[gwada] public change request", error.message);
    return { data: null, error: "update_failed", status: 500 };
  }

  const before = reservationSnapshotFromPayload(
    {
      guest_first_name: existing.guest_first_name,
      guest_last_name: existing.guest_last_name,
      guest_phone: existing.guest_phone,
      guest_email: existing.guest_email,
      party_size: existing.party_size,
      starts_at: existing.starts_at,
      ends_at: existing.ends_at,
      status_id: "",
      dining_table_id: existing.dining_table_id,
      dwell_minutes: existing.dwell_minutes,
      notify_email: existing.notify_email,
      notify_whatsapp: existing.notify_whatsapp,
      terms_accepted: existing.terms_accepted,
    },
    existing.status_code,
    "Kein Tisch",
  );
  const after = reservationSnapshotFromPayload(
    { ...patch, status_id: "", dining_table_id: existing.dining_table_id },
    "Änderung angefragt",
    "Kein Tisch",
  );
  await insertReservationLogEntry(admin, {
    restaurantId: restaurantRes.data.id,
    reservationId: existing.id,
    actorUserId: null,
    action: "change_request_submitted",
    reservationNumber: existing.reservation_number,
    guestLabel: formatReservationGuestLabel(
      existing.reservation_number,
      patch.guest_first_name,
      patch.guest_last_name,
    ),
    details: buildReservationLogDetails(
      buildReservationLogChanges(before, after),
      { actorSource: "guest", summary: "Änderungsanfrage vom Gast" },
    ),
  });

  return { data: { ok: true, change_request: true }, error: null };
}
