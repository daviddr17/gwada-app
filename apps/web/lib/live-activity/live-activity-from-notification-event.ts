import {
  dashboardMessageThreadHref,
  dashboardMessagesInboxHref,
} from "@/lib/contact-messages/messages-unread-summary";
import { privateEventOverviewHref } from "@/lib/events/private-event-href";
import {
  isNotificationModuleId,
  NOTIFICATION_MODULES,
} from "@/lib/notifications/notification-modules";
import { formatNotificationPayloadSummary } from "@/lib/superadmin/superadmin-notification-log";
import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";
import { restaurantIsoToYmdHm } from "@/lib/restaurant/restaurant-timezone";

function pickString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function guestFromPayload(payload: Record<string, unknown>): string | null {
  return (
    pickString(payload.guest_name) ??
    pickString(payload.contactName) ??
    pickString(payload.contact_name) ??
    pickString(payload.staff_name) ??
    pickString(payload.staffName) ??
    pickString(payload.author_name)
  );
}

function contactIdFromPayload(payload: Record<string, unknown>): string | null {
  return pickString(payload.contactId) ?? pickString(payload.contact_id);
}

function staffIdFromPayload(payload: Record<string, unknown>): string | null {
  return pickString(payload.staffId) ?? pickString(payload.staff_id);
}

/** Reservierungs-ID aus Payload oder reference_id (Status-Events: `<uuid>:<module>`). */
export function reservationIdFromNotificationEvent(
  module: string,
  payload: Record<string, unknown>,
  referenceId?: string | null,
): string | null {
  const fromPayload =
    pickString(payload.reservationId) ?? pickString(payload.reservation_id);
  if (fromPayload) return fromPayload;

  const ref = referenceId?.trim();
  if (!ref) return null;

  if (module === "reservations_pending" || module === "events_inquiry") {
    return ref;
  }

  if (
    module === "reservations_change_request" ||
    module === "reservations_cancellation"
  ) {
    const colon = ref.indexOf(":");
    return colon > 0 ? ref.slice(0, colon) : ref;
  }

  return ref;
}

function appendQueryParam(href: string, key: string, value: string): string {
  const url = new URL(href, "https://gwada.local");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

/** Live-Verlauf: event-spezifische Links wie in der Glocke — nicht nur Modul-Default. */
export function hrefForNotificationModule(
  module: string,
  payload: Record<string, unknown>,
  defHref: string | null,
  referenceId?: string | null,
): string | null {
  if (module === "messages") {
    const contactId = contactIdFromPayload(payload);
    if (contactId) return dashboardMessageThreadHref(contactId);
    return dashboardMessagesInboxHref();
  }

  if (
    module === "reservations_pending" ||
    module === "reservations_change_request" ||
    module === "reservations_cancellation"
  ) {
    const reservationId = reservationIdFromNotificationEvent(
      module,
      payload,
      referenceId,
    );
    if (reservationId) {
      return `/dashboard/reservierungen/uebersicht?reservation=${encodeURIComponent(reservationId)}`;
    }
  }

  if (module === "events_inquiry") {
    const reservationId = reservationIdFromNotificationEvent(
      module,
      payload,
      referenceId,
    );
    return privateEventOverviewHref(reservationId);
  }

  if (module === "staff_display_clock_in" || module === "staff_display_clock_out") {
    const staffId = staffIdFromPayload(payload);
    if (staffId && defHref) {
      return appendQueryParam(defHref, "staff", staffId);
    }
  }

  if (module === "staff_shift_start" || module === "staff_shift_end") {
    const base = defHref ?? "/dashboard/mitarbeiter/schichtplan";
    const iso =
      module === "staff_shift_start"
        ? pickString(payload.startsAt)
        : pickString(payload.endsAt) ?? pickString(payload.startsAt);
    if (iso) {
      const { ymd } = restaurantIsoToYmdHm(iso);
      return appendQueryParam(base, "day", ymd);
    }
    return base;
  }

  return defHref ?? null;
}

/** Human-readable Titel für den Live-Feed (nicht Settings-Labels der Glocke). */
function feedTitleForModule(module: string, guest: string | null): string {
  switch (module) {
    case "staff_display_clock_in":
      return guest ? `${guest} · Login` : "Mitarbeiter Login";
    case "staff_display_clock_out":
      return guest ? `${guest} · Logout` : "Mitarbeiter Logout";
    case "staff_shift_start":
      return guest ? `${guest} · Schichtstart` : "Schichtstart";
    case "staff_shift_end":
      return guest ? `${guest} · Schichtende` : "Schichtende";
    case "inventory_low_stock":
      return "Bestand niedrig";
    case "reservations_pending":
      return "Neue Reservierung";
    case "reservations_change_request":
      return "Reservierungsänderung";
    case "reservations_cancellation":
      return "Stornierung";
    case "messages":
      return guest ? `Nachricht · ${guest}` : "Neue Nachricht";
    default: {
      const moduleId = isNotificationModuleId(module) ? module : null;
      return moduleId ? NOTIFICATION_MODULES[moduleId].label : module;
    }
  }
}

/** notification_events → Live-Feed-Zeile. */
export function liveActivityFromNotificationEvent(params: {
  eventId?: string | null;
  referenceId?: string | null;
  module: string;
  payload: Record<string, unknown>;
  createdAt?: string | null;
}): Omit<LiveActivityItem, "id" | "at"> & { id?: string; at?: string } {
  const moduleId = isNotificationModuleId(params.module)
    ? params.module
    : null;
  const def = moduleId ? NOTIFICATION_MODULES[moduleId] : null;
  const guest = guestFromPayload(params.payload);
  const summary = formatNotificationPayloadSummary(
    params.module,
    params.payload,
  );
  const title = feedTitleForModule(params.module, guest);

  let description: string | null =
    summary.trim() ||
    pickString(params.payload.title) ||
    pickString(params.payload.body) ||
    null;

  // Bei Login/Logout ist der Name schon im Titel — Summary nur wenn anders.
  if (
    (params.module === "staff_display_clock_in" ||
      params.module === "staff_display_clock_out") &&
    guest &&
    description === guest
  ) {
    description =
      params.module === "staff_display_clock_in"
        ? "Hat sich am Display angemeldet"
        : "Hat sich am Display abgemeldet";
  }

  return {
    id: params.eventId ? `evt:${params.eventId}` : undefined,
    kind: "notification",
    module: params.module,
    title,
    description,
    href: hrefForNotificationModule(
      params.module,
      params.payload,
      def?.href ?? null,
      params.referenceId,
    ),
    at: params.createdAt ?? undefined,
  };
}
