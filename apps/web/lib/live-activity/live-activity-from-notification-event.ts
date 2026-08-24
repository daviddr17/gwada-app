import {
  dashboardMessageThreadHref,
  dashboardMessagesInboxHref,
} from "@/lib/contact-messages/messages-unread-summary";
import {
  isNotificationModuleId,
  NOTIFICATION_MODULES,
} from "@/lib/notifications/notification-modules";
import { formatNotificationPayloadSummary } from "@/lib/superadmin/superadmin-notification-log";
import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";

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

/** Heute live: konkreter Thread — nicht Ungelesen-Filter (Event bleibt, Chat kann schon gelesen sein). */
function hrefForNotificationModule(
  module: string,
  payload: Record<string, unknown>,
  defHref: string | null,
): string | null {
  if (module === "messages") {
    const contactId = contactIdFromPayload(payload);
    if (contactId) return dashboardMessageThreadHref(contactId);
    return dashboardMessagesInboxHref();
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
    ),
    at: params.createdAt ?? undefined,
  };
}
