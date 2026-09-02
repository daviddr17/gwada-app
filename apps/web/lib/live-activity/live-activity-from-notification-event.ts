import {
  dashboardMessageThreadHref,
  dashboardMessagesInboxHref,
} from "@/lib/contact-messages/messages-unread-summary";
import { privateEventOverviewHref } from "@/lib/events/private-event-href";
import {
  isNotificationModuleId,
  NOTIFICATION_MODULES,
} from "@/lib/notifications/notification-modules";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { purchaseOrderStatusLabel } from "@/lib/inventory/purchase-order-status";
import { formatNotificationPayloadSummary } from "@/lib/superadmin/superadmin-notification-log";
import type { LiveActivityItem } from "@/lib/live-activity/live-activity-types";
import { restaurantIsoToYmdHm } from "@/lib/restaurant/restaurant-timezone";

function pickNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function staffNameFromPayload(payload: Record<string, unknown>): string | null {
  return pickString(payload.staffName) ?? guestFromPayload(payload);
}

function qtyUnitLabel(qty: number, unitLabel: string): string {
  const u = unitLabel.trim();
  const q = Number.isInteger(qty) ? String(qty) : String(qty).replace(".", ",");
  return u ? `${q} ${u}` : q;
}

function poActivityDescription(payload: Record<string, unknown>): string | null {
  const kind = pickString(payload.kind);
  const name = pickString(payload.ingredientName);
  const unit = pickString(payload.unitLabel) ?? "";
  const supplier = pickString(payload.supplierName);

  switch (kind) {
    case "add_to_order": {
      const qty = pickNumber(payload.quantity);
      if (name && qty != null) {
        return supplier
          ? `„${name}“ · ${qtyUnitLabel(qty, unit)} · ${supplier}`
          : `„${name}“ · ${qtyUnitLabel(qty, unit)}`;
      }
      return name ? `„${name}“` : null;
    }
    case "quantity_change": {
      const from = pickNumber(payload.fromQuantity);
      const to = pickNumber(payload.toQuantity);
      if (name && from != null && to != null) {
        if (to === 0) return `„${name}“ entfernt`;
        return `„${name}“ · ${qtyUnitLabel(from, unit)} → ${qtyUnitLabel(to, unit)}`;
      }
      return name ? `„${name}“` : null;
    }
    case "status_change": {
      const from = pickString(payload.fromStatus);
      const to = pickString(payload.toStatus);
      if (from && to) {
        const label = (s: string) =>
          s === "open" || s === "ordered" || s === "closed"
            ? purchaseOrderStatusLabel(s)
            : s;
        return supplier
          ? `„${supplier}“ · ${label(from)} → ${label(to)}`
          : `${label(from)} → ${label(to)}`;
      }
      return supplier ? `„${supplier}“` : null;
    }
    case "marked_delivered":
    case "delivery_reverted": {
      const qty = pickNumber(payload.quantity);
      if (name && qty != null) {
        return `„${name}“ · ${qtyUnitLabel(qty, unit)}`;
      }
      return name ? `„${name}“` : null;
    }
    default:
      return name ? `„${name}“` : supplier ? `„${supplier}“` : null;
  }
}

function stockKindLabel(kind: string): string {
  switch (kind) {
    case "manual_stock":
      return "Menge geändert";
    case "stock_from_delivery":
      return "Geliefert markiert";
    case "stock_delivery_reverted":
      return "Geliefert rückgängig";
    case "stock_from_invoice":
      return "Rechnung";
    case "stock_from_invoice_correction":
      return "Rechnungskorrektur";
    case "stock_from_pos_order":
      return "POS-Bestellung";
    case "stock_from_pos_void":
      return "POS-Storno";
    default:
      return "Bestand";
  }
}

function stockActivityDescription(payload: Record<string, unknown>): string | null {
  const kind = pickString(payload.kind);
  const name = pickString(payload.ingredientName);
  const unit = pickString(payload.unitLabel) ?? "";
  const from = pickNumber(payload.fromQuantity);
  const to = pickNumber(payload.toQuantity);

  if (name && from != null && to != null) {
    return `„${name}“ · ${qtyUnitLabel(from, unit)} → ${qtyUnitLabel(to, unit)}`;
  }
  if (kind && name) {
    return `„${name}“ · ${stockKindLabel(kind)}`;
  }
  return name ? `„${name}“` : null;
}

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

  if (module === "inventory_po_activity") {
    const orderId = pickString(payload.orderId);
    if (orderId) {
      return appendQueryParam(
        APP_ROUTES.inventory.order,
        "order",
        orderId,
      );
    }
    return APP_ROUTES.inventory.order;
  }

  if (module === "inventory_stock_activity") {
    return APP_ROUTES.inventory.overview;
  }

  return defHref ?? null;
}

function poActivityTitle(
  payload: Record<string, unknown>,
  staff: string | null,
): string {
  const kind = pickString(payload.kind);
  const prefix = staff ? `${staff} · ` : "";
  switch (kind) {
    case "add_to_order":
      return `${prefix}Zur Bestellung`;
    case "quantity_change":
      return `${prefix}Bestellmenge`;
    case "status_change":
      return `${prefix}Bestellstatus`;
    case "marked_delivered":
      return `${prefix}Lieferung erfasst`;
    case "delivery_reverted":
      return `${prefix}Lieferung zurück`;
    default:
      return staff ? `${staff} · Bestellung` : "Bestellung";
  }
}

function stockActivityTitle(
  payload: Record<string, unknown>,
  staff: string | null,
): string {
  const kind = pickString(payload.kind);
  const prefix = staff ? `${staff} · ` : "";
  switch (kind) {
    case "manual_stock":
      return `${prefix}Bestand geändert`;
    case "stock_from_delivery":
      return `${prefix}Bestand · Lieferung`;
    case "stock_delivery_reverted":
      return `${prefix}Bestand · Lieferung zurück`;
    case "stock_from_invoice":
      return `${prefix}Bestand · Rechnung`;
    case "stock_from_invoice_correction":
      return `${prefix}Bestand · Korrektur`;
    case "stock_from_pos_order":
      return `${prefix}Bestand · POS`;
    case "stock_from_pos_void":
      return `${prefix}Bestand · Storno`;
    default:
      return staff ? `${staff} · Bestand` : "Bestand";
  }
}

/** Human-readable Titel für den Live-Feed (nicht Settings-Labels der Glocke). */
function feedTitleForModule(
  module: string,
  guest: string | null,
  payload?: Record<string, unknown>,
): string {
  switch (module) {
    case "inventory_po_activity":
      return poActivityTitle(payload ?? {}, guest);
    case "inventory_stock_activity":
      return stockActivityTitle(payload ?? {}, guest);
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
    case "inventory_po_delivery_due":
      return "Lieferung fällig";
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
  const guest =
    params.module === "inventory_po_activity" ||
    params.module === "inventory_stock_activity"
      ? staffNameFromPayload(params.payload)
      : guestFromPayload(params.payload);
  const summary = formatNotificationPayloadSummary(
    params.module,
    params.payload,
  );
  const title = feedTitleForModule(params.module, guest, params.payload);

  let description: string | null =
    (params.module === "inventory_po_activity"
      ? poActivityDescription(params.payload)
      : params.module === "inventory_stock_activity"
        ? stockActivityDescription(params.payload)
        : null) ??
    (summary.trim() ||
      pickString(params.payload.title) ||
      pickString(params.payload.body) ||
      null);

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
