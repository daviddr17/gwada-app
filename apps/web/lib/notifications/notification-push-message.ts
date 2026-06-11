import "server-only";

import {
  NOTIFICATION_MODULES,
  type NotificationModuleId,
} from "@/lib/notifications/notification-modules";
import { getPublicSiteUrl } from "@/lib/public-env";

function absoluteAppUrl(path: string): string {
  const base =
    getPublicSiteUrl()?.replace(/\/$/, "") ?? "https://new.gwada.app";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

type NotificationEventRow = {
  module: NotificationModuleId;
  payload: Record<string, unknown>;
};

function formatStockAmount(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return String(value);
}

export function buildNotificationPushText(
  event: NotificationEventRow,
  restaurantName: string | null,
): { text: string; subject: string } {
  const prefix = restaurantName ? `${restaurantName}: ` : "";
  const moduleDef = NOTIFICATION_MODULES[event.module];
  const href = absoluteAppUrl(moduleDef.href);
  const p = event.payload;

  switch (event.module) {
    case "messages": {
      const name =
        typeof p.contactName === "string" ? p.contactName : "Kontakt";
      const preview =
        typeof p.preview === "string" && p.preview.trim()
          ? `\n„${p.preview.trim()}“`
          : "";
      const text = `${prefix}Neue Nachricht von ${name}.${preview}\n\n${href}`;
      return {
        subject: `${prefix}Neue Nachricht — ${name}`,
        text,
      };
    }
    case "reviews": {
      const author =
        typeof p.authorName === "string" ? p.authorName : "Gast";
      const rating =
        typeof p.rating === "number" ? Math.round(p.rating) : 0;
      const stars = rating > 0 ? ` (${rating}★)` : "";
      const platform =
        typeof p.platform === "string" && p.platform !== "gwada"
          ? ` (${p.platform})`
          : "";
      const text = `${prefix}Neue Bewertung von ${author}${stars}${platform}.\n\n${href}`;
      return {
        subject: `${prefix}Neue Bewertung${stars}`,
        text,
      };
    }
    case "reservations_pending": {
      const guest =
        typeof p.guestLabel === "string" ? p.guestLabel : "Gast";
      const party =
        typeof p.partySize === "number" ? p.partySize : null;
      const partyText = party ? ` · ${party} Gäste` : "";
      const text = `${prefix}Neue unbestätigte Reservierung: ${guest}${partyText}.\n\n${href}`;
      return {
        subject: `${prefix}Neue Reservierung — ${guest}`,
        text,
      };
    }
    case "reservations_change_request": {
      const guest =
        typeof p.guestLabel === "string" ? p.guestLabel : "Gast";
      const text = `${prefix}Änderungsanfrage: ${guest}.\n\n${href}`;
      return {
        subject: `${prefix}Änderungsanfrage — ${guest}`,
        text,
      };
    }
    case "reservations_cancellation": {
      const guest =
        typeof p.guestLabel === "string" ? p.guestLabel : "Gast";
      const text = `${prefix}Stornierung: ${guest}.\n\n${href}`;
      return {
        subject: `${prefix}Stornierung — ${guest}`,
        text,
      };
    }
    case "staff_shift_start": {
      const staffName =
        typeof p.staffName === "string" ? p.staffName : "Mitarbeiter";
      const text = `${prefix}Schichtbeginn: ${staffName}.\n\n${href}`;
      return {
        subject: `${prefix}Schichtbeginn — ${staffName}`,
        text,
      };
    }
    case "staff_shift_end": {
      const staffName =
        typeof p.staffName === "string" ? p.staffName : "Mitarbeiter";
      const text = `${prefix}Schichtende: ${staffName}.\n\n${href}`;
      return {
        subject: `${prefix}Schichtende — ${staffName}`,
        text,
      };
    }
    case "inventory_low_stock": {
      const name =
        typeof p.ingredientName === "string" ? p.ingredientName : "Zutat";
      const stock = formatStockAmount(p.currentStock);
      const threshold = formatStockAmount(p.lowStockThreshold);
      const unit = typeof p.unit === "string" ? p.unit : "";
      const unitText = unit ? ` ${unit}` : "";
      const text = `${prefix}Niedrigbestand: ${name} (${stock}${unitText}, Schwelle ${threshold}).\n\n${href}`;
      return {
        subject: `${prefix}Niedrigbestand — ${name}`,
        text,
      };
    }
    case "changelog": {
      const title = typeof p.title === "string" ? p.title : "Changelog";
      const text = `Neu im Changelog: ${title}\n\n${href}`;
      return {
        subject: `Changelog: ${title}`,
        text,
      };
    }
  }
}
