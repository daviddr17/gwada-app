import "server-only";

import {
  NOTIFICATION_MODULES,
  type NotificationModuleId,
} from "@/lib/notifications/notification-modules";
import {
  senderPhoneDistinctFromName,
} from "@/lib/notifications/message-notification-sender";
import { GWADA_PRODUCTION_ORIGIN } from "@/lib/constants/gwada-domains";
import { getPublicSiteUrl } from "@/lib/public-env";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

function absoluteAppUrl(path: string): string {
  const base =
    getPublicSiteUrl()?.replace(/\/$/, "") ?? GWADA_PRODUCTION_ORIGIN;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

type NotificationEventRow = {
  module: NotificationModuleId;
  payload: Record<string, unknown>;
};

const pushDateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const pushTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

function pickString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pickNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatPushDateTime(iso: unknown): string | null {
  const raw = pickString(iso);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return pushDateTimeFormatter.format(date);
}

function formatPushTime(iso: unknown): string | null {
  const raw = pickString(iso);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return pushTimeFormatter.format(date);
}

function formatStockAmount(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return String(value);
}

function formatRatingStars(rating: number): string {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  if (rounded <= 0) return "";
  return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
}

function platformLabel(platform: unknown): string | null {
  const code = pickString(platform)?.toLowerCase();
  if (!code) return null;
  const labels: Record<string, string> = {
    gwada: "Gwada",
    google: "Google",
    facebook: "Facebook",
    whatsapp: "WhatsApp",
    email: "E-Mail",
    instagram: "Instagram",
  };
  return labels[code] ?? code;
}

function quotePreview(text: unknown): string | null {
  const value = pickString(text);
  if (!value) return null;
  return `„${value}“`;
}

function detailLines(lines: Array<string | null | undefined | false>): string {
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

function messageSenderDetailLines(payload: Record<string, unknown>): string[] {
  const name = pickString(payload.contactName) ?? "Kontakt";
  const email = pickString(payload.senderEmail);
  const phone = pickString(payload.senderPhone);
  const lines: string[] = [`Von: ${name}`];
  if (email && email.toLowerCase() !== name.toLowerCase()) {
    lines.push(`E-Mail: ${email}`);
  }
  if (phone && senderPhoneDistinctFromName(name, phone)) {
    lines.push(`Telefon: ${phone}`);
  }
  return lines;
}

function messagePushSubjectName(payload: Record<string, unknown>): string {
  const name = pickString(payload.contactName) ?? "Kontakt";
  const email = pickString(payload.senderEmail);
  const phone = pickString(payload.senderPhone);
  if (name !== "Kontakt" && name !== "WhatsApp" && name !== "E-Mail") {
    return name;
  }
  if (email) return email;
  if (phone) return phone;
  return name;
}

export type NotificationPushMessageResult = {
  /** WhatsApp / Plain-Text mit Intro-Zeile */
  text: string;
  subject: string;
  /** Nur Detailblock für E-Mail-Body (ohne Intro-Doppelung zur Karten-Überschrift) */
  emailDetails: string | null;
  href: string;
  /** Roh-Code für Plattform-Icon in E-Mails (z. B. whatsapp) */
  platformCode?: string | null;
};

function buildPushMessage(params: {
  prefix: string;
  headline: string;
  subject: string;
  href: string;
  details?: string | null;
  platformCode?: string | null;
}): NotificationPushMessageResult {
  const intro = params.prefix
    ? `${params.prefix}${params.headline}`
    : params.headline;
  const detailBlock = params.details?.trim() ?? "";
  const textParts = [intro];
  if (detailBlock) textParts.push(detailBlock);
  textParts.push(params.href);
  return {
    subject: params.subject,
    text: textParts.join("\n\n"),
    emailDetails: detailBlock || null,
    href: params.href,
    platformCode: params.platformCode ?? null,
  };
}

function reservationDetails(payload: Record<string, unknown>): string {
  const guest = pickString(payload.guestLabel) ?? "Gast";
  const party = pickNumber(payload.partySize);
  const when = formatPushDateTime(payload.startsAt);
  const number = pickNumber(payload.reservationNumber);
  const phone = pickString(payload.guestPhone);
  const email = pickString(payload.guestEmail);
  const notes = pickString(payload.notesPreview);
  const messagePreview = pickString(payload.messagePreview);

  return detailLines([
    `Gast: ${guest}`,
    party != null ? `Personen: ${party}` : null,
    when ? `Termin: ${when}` : null,
    number != null ? `Reservierung Nr. ${number}` : null,
    phone ? `Telefon: ${phone}` : null,
    email ? `E-Mail: ${email}` : null,
    notes ? `Hinweis: ${notes}` : null,
    messagePreview ? `Nachricht: ${messagePreview}` : null,
  ]);
}

export function buildNotificationPushText(
  event: NotificationEventRow,
  restaurantName: string | null,
): NotificationPushMessageResult {
  const prefix = restaurantName ? `${restaurantName}: ` : "";
  const moduleDef = NOTIFICATION_MODULES[event.module];
  const href = absoluteAppUrl(moduleDef.href);
  const p = event.payload;

  switch (event.module) {
    case "messages": {
      const subjectName = messagePushSubjectName(p);
      const platformCode = pickString(p.platform)?.toLowerCase() ?? null;
      const platform = platformLabel(p.platform);
      const when = formatPushDateTime(p.messageCreatedAt);
      const preview = quotePreview(p.preview);
      return buildPushMessage({
        prefix,
        headline: "Neue Nachricht",
        subject: `${prefix}Neue Nachricht — ${subjectName}`,
        href,
        platformCode,
        details: detailLines([
          ...messageSenderDetailLines(p),
          platform ? `Kanal: ${platform}` : null,
          when ? `Empfangen: ${when}` : null,
          preview,
        ]),
      });
    }
    case "reviews": {
      const author = pickString(p.authorName) ?? "Gast";
      const rating = pickNumber(p.rating);
      const stars = rating != null && rating > 0 ? formatRatingStars(rating) : null;
      const platform = platformLabel(p.platform);
      const when = formatPushDateTime(p.reviewCreatedAt);
      const preview = quotePreview(p.commentPreview);
      const ratingLine =
        stars != null
          ? `Bewertung: ${stars}${rating != null ? ` (${Math.round(rating)}/5)` : ""}`
          : null;
      return buildPushMessage({
        prefix,
        headline: platform ? `Neue Bewertung (${platform})` : "Neue Bewertung",
        subject: `${prefix}Neue Bewertung${rating != null && rating > 0 ? ` — ${Math.round(rating)}★` : ""}`,
        href,
        details: detailLines([
          `Von: ${author}`,
          ratingLine,
          when ? `Bewertet am: ${when}` : null,
          preview,
        ]),
      });
    }
    case "reservations_pending": {
      const guest = pickString(p.guestLabel) ?? "Gast";
      return buildPushMessage({
        prefix,
        headline: "Neue unbestätigte Reservierung",
        subject: `${prefix}Neue Reservierung — ${guest}`,
        href,
        details: reservationDetails(p),
      });
    }
    case "reservations_change_request": {
      const guest = pickString(p.guestLabel) ?? "Gast";
      return buildPushMessage({
        prefix,
        headline: "Änderungsanfrage zur Reservierung",
        subject: `${prefix}Änderungsanfrage — ${guest}`,
        href,
        details: reservationDetails(p),
      });
    }
    case "reservations_cancellation": {
      const guest = pickString(p.guestLabel) ?? "Gast";
      return buildPushMessage({
        prefix,
        headline: "Stornierung einer Reservierung",
        subject: `${prefix}Stornierung — ${guest}`,
        href,
        details: reservationDetails(p),
      });
    }
    case "staff_shift_start": {
      const staffName = pickString(p.staffName) ?? "Mitarbeiter";
      const label = pickString(p.label);
      const start = formatPushTime(p.startsAt);
      const end = formatPushTime(p.endsAt);
      const timeRange =
        start && end ? `${start}–${end} Uhr` : start ? `${start} Uhr` : null;
      return buildPushMessage({
        prefix,
        headline: "Schichtbeginn",
        subject: `${prefix}Schichtbeginn — ${staffName}`,
        href,
        details: detailLines([
          `Mitarbeiter: ${staffName}`,
          label ? `Schicht: ${label}` : null,
          timeRange ? `Zeit: ${timeRange}` : null,
          formatPushDateTime(p.startsAt)
            ? `Beginn: ${formatPushDateTime(p.startsAt)}`
            : null,
        ]),
      });
    }
    case "staff_shift_end": {
      const staffName = pickString(p.staffName) ?? "Mitarbeiter";
      const label = pickString(p.label);
      const start = formatPushTime(p.startsAt);
      const end = formatPushTime(p.endsAt);
      const timeRange =
        start && end ? `${start}–${end} Uhr` : end ? `${end} Uhr` : null;
      return buildPushMessage({
        prefix,
        headline: "Schichtende",
        subject: `${prefix}Schichtende — ${staffName}`,
        href,
        details: detailLines([
          `Mitarbeiter: ${staffName}`,
          label ? `Schicht: ${label}` : null,
          timeRange ? `Geplant: ${timeRange}` : null,
          formatPushDateTime(p.endsAt)
            ? `Ende: ${formatPushDateTime(p.endsAt)}`
            : null,
        ]),
      });
    }
    case "inventory_low_stock": {
      const name = pickString(p.ingredientName) ?? "Zutat";
      const stock = formatStockAmount(p.currentStock);
      const threshold = formatStockAmount(p.lowStockThreshold);
      const unit = pickString(p.unit);
      const unitText = unit ? ` ${unit}` : "";
      return buildPushMessage({
        prefix,
        headline: "Niedrigbestand",
        subject: `${prefix}Niedrigbestand — ${name}`,
        href,
        details: detailLines([
          `Zutat: ${name}`,
          `Bestand: ${stock}${unitText}`,
          `Schwelle: ${threshold}${unitText}`,
        ]),
      });
    }
    case "accounting_quotation": {
      const title = pickString(p.title) ?? "Neues Angebot";
      const number = pickString(p.voucherNumber);
      const recipient = pickString(p.recipientLabel);
      const amount = pickString(p.amountLabel);
      return buildPushMessage({
        prefix,
        headline: "Neues Angebot",
        subject: `${prefix}Neues Angebot${number ? ` — ${number}` : ""}`,
        href,
        details: detailLines([
          `Titel: ${title}`,
          number ? `Nummer: ${number}` : null,
          recipient ? `Empfänger: ${recipient}` : null,
          amount ? `Betrag: ${amount}` : null,
        ]),
      });
    }
    case "accounting_invoice": {
      const title = pickString(p.title) ?? "Neue Rechnung";
      const number = pickString(p.voucherNumber);
      const recipient = pickString(p.recipientLabel);
      const amount = pickString(p.amountLabel);
      return buildPushMessage({
        prefix,
        headline: "Neue Rechnung",
        subject: `${prefix}Neue Rechnung${number ? ` — ${number}` : ""}`,
        href,
        details: detailLines([
          `Titel: ${title}`,
          number ? `Nummer: ${number}` : null,
          recipient ? `Empfänger: ${recipient}` : null,
          amount ? `Betrag: ${amount}` : null,
        ]),
      });
    }
    case "accounting_voucher": {
      const contact = pickString(p.contactName) ?? "Beleg";
      const number = pickString(p.voucherNumber);
      const amount = pickString(p.amountLabel);
      return buildPushMessage({
        prefix,
        headline: "Neuer Beleg",
        subject: `${prefix}Neuer Beleg${number ? ` — ${number}` : ""}`,
        href,
        details: detailLines([
          contact ? `Kontakt: ${contact}` : null,
          number ? `Nummer: ${number}` : null,
          amount ? `Betrag: ${amount}` : null,
        ]),
      });
    }
    case "staff_todo_completed": {
      const title = pickString(p.todoTitle) ?? "ToDo";
      return buildPushMessage({
        prefix,
        headline: "ToDo erledigt",
        subject: `${prefix}ToDo erledigt — ${title}`,
        href,
        details: detailLines([`Aufgabe: ${title}`]),
      });
    }
    case "staff_todo_deferred": {
      const title = pickString(p.todoTitle) ?? "ToDo";
      const details =
        p.details && typeof p.details === "object"
          ? (p.details as Record<string, unknown>)
          : null;
      const reason = pickString(details?.reason) ?? pickString(p.reason);
      return buildPushMessage({
        prefix,
        headline: "ToDo verschoben",
        subject: `${prefix}ToDo verschoben — ${title}`,
        href,
        details: detailLines([
          `Aufgabe: ${title}`,
          reason ? `Grund: ${reason}` : null,
        ]),
      });
    }
    case "staff_contract_signed": {
      const title = pickString(p.contractTitle) ?? "Arbeitsvertrag";
      const revised = p.revised === true;
      const pending = p.pendingEmployeeSignature === true;
      return buildPushMessage({
        prefix,
        headline: pending
          ? "Vertrag unterschreiben"
          : revised
            ? "Vertrag überarbeitet"
            : "Neuer Arbeitsvertrag",
        subject: `${prefix}${
          pending
            ? "Vertrag unterschreiben"
            : revised
              ? "Vertrag überarbeitet"
              : "Neuer Arbeitsvertrag"
        } — ${title}`,
        href: APP_ROUTES.profile.documents,
        details: detailLines([
          title,
          pending
            ? "Bitte im Profil unter „Meine Dokumente“ unterschreiben."
            : "Im Profil unter „Meine Dokumente“ einsehbar und herunterladbar.",
        ]),
      });
    }
    case "staff_display_time_request": {
      const time = pickString(p.requestedStartsAt);
      const end = pickString(p.requestedEndsAt);
      const entryType = pickString(p.entryType);
      return buildPushMessage({
        prefix,
        headline: "Zeit nachtragen",
        subject: `${prefix}Nachtragungs-Anfrage vom Display`,
        href,
        details: detailLines([
          entryType ? `Art: ${entryType}` : null,
          time && end ? `Zeitraum: ${time} – ${end}` : time ? `Beginn: ${time}` : null,
          "Bitte im Mitarbeiter-Dashboard prüfen und freigeben.",
        ]),
      });
    }
    case "changelog": {
      const title = pickString(p.title) ?? "Changelog";
      const version = pickString(p.version);
      const when = formatPushDateTime(p.publishedAt);
      return buildPushMessage({
        prefix: "",
        headline: "Neu im Changelog",
        subject: `Changelog: ${title}`,
        href,
        details: detailLines([
          `Titel: ${title}`,
          version ? `Version: ${version}` : null,
          when ? `Veröffentlicht: ${when}` : null,
        ]),
      });
    }
  }
}
