import "server-only";

import {
  NOTIFICATION_MODULES,
  type NotificationModuleId,
} from "@/lib/notifications/notification-modules";
import {
  senderPhoneDistinctFromName,
} from "@/lib/notifications/message-notification-sender";
import { DEFAULT_RESTAURANT_TIMEZONE } from "@/lib/restaurant/restaurant-timezone";
import { GWADA_PRODUCTION_ORIGIN } from "@/lib/constants/gwada-domains";
import { getPublicSiteUrl } from "@/lib/public-env";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import {
  formatPoStatusEmailBodyHtml,
  formatPoStatusPushDetails,
  parsePoStatusLines,
} from "@/lib/notifications/notification-po-status-copy";
import { digestPushDetails } from "@/lib/notifications/notification-digest-server";
import { APP_LOCALE_TO_PROFILE, normalizeAppLocale } from "@/i18n/config";
import {
  localizeInventoryUnitLabel,
  resolveInventoryNotificationLocale,
} from "@/lib/inventory/inventory-unit-label-for-locale";
import {
  moduleNoticeLabel,
  staffNotificationCopy,
  type StaffNotificationCopy,
} from "@/lib/notifications/staff-notification-copy";
import {
  voucherNoticeHeadline,
  voucherUploadedAtLexofficeLine,
} from "@/lib/live-activity/live-activity-accounting-uploader";

function absoluteAppUrl(path: string): string {
  const base =
    getPublicSiteUrl()?.replace(/\/$/, "") ?? GWADA_PRODUCTION_ORIGIN;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

type NotificationEventRow = {
  module: NotificationModuleId;
  payload: Record<string, unknown>;
};

function intlTag(locale: string): string {
  return APP_LOCALE_TO_PROFILE[normalizeAppLocale(locale)];
}

function pushDateTimeFormatter(
  timeZone: string,
  locale: string,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(intlTag(locale), {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

function pushTimeFormatter(timeZone: string, locale: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(intlTag(locale), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

function pickString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pickNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatPushDateTime(
  iso: unknown,
  timeZone?: string,
  locale = "de",
): string | null {
  const raw = pickString(iso);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const tz = timeZone?.trim() || DEFAULT_RESTAURANT_TIMEZONE;
  return pushDateTimeFormatter(tz, locale).format(date);
}

function formatPushTime(
  iso: unknown,
  timeZone?: string,
  locale = "de",
): string | null {
  const raw = pickString(iso);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const tz = timeZone?.trim() || DEFAULT_RESTAURANT_TIMEZONE;
  return pushTimeFormatter(tz, locale).format(date);
}

function clockLabel(value: string, copy: StaffNotificationCopy): string {
  return `${value}${copy.clockSuffix}`;
}

function formatStockAmount(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return String(value);
}

function pickQuantity(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatQuantityForLocale(qty: number, locale: string): string {
  const text = Number.isInteger(qty) ? String(qty) : String(qty);
  return locale === "de" ? text.replace(".", ",") : text;
}

function quantityWithUnit(
  qty: number,
  unit: string,
  locale: string,
): string {
  const shown = formatQuantityForLocale(qty, locale);
  return unit ? `${shown} ${unit}` : shown;
}

function localizedUnit(
  raw: string | null,
  locale: string,
): string {
  if (!raw) return "";
  return localizeInventoryUnitLabel(raw, locale);
}

function formatRatingStars(rating: number): string {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  if (rounded <= 0) return "";
  return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
}

function platformLabel(platform: unknown, locale: string): string | null {
  const code = pickString(platform)?.toLowerCase();
  if (!code) return null;
  const labels: Record<string, string> = {
    gwada: "Gwada",
    google: "Google",
    facebook: "Facebook",
    whatsapp: "WhatsApp",
    email: normalizeAppLocale(locale) === "de" ? "E-Mail" : "Email",
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

function messageSenderDetailLines(
  payload: Record<string, unknown>,
  copy: StaffNotificationCopy,
): string[] {
  const name = pickString(payload.contactName) ?? copy.contact;
  const email = pickString(payload.senderEmail);
  const phone = pickString(payload.senderPhone);
  const lines: string[] = [`${copy.from}: ${name}`];
  if (email && email.toLowerCase() !== name.toLowerCase()) {
    lines.push(`${copy.email}: ${email}`);
  }
  if (phone && senderPhoneDistinctFromName(name, phone)) {
    lines.push(`${copy.phone}: ${phone}`);
  }
  return lines;
}

function messagePushSubjectName(
  payload: Record<string, unknown>,
  copy: StaffNotificationCopy,
): string {
  const name = pickString(payload.contactName) ?? copy.contact;
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
  /** Fertiges HTML für den Karten-Inhalt, z. B. Positionstabelle. */
  emailBodyHtml?: string | null;
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
  emailBodyHtml?: string | null;
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
    emailBodyHtml: params.emailBodyHtml?.trim() || null,
    href: params.href,
    platformCode: params.platformCode ?? null,
  };
}

const PEOPLE_LABEL: Record<string, string> = {
  de: "Personen",
  en: "People",
  es: "Personas",
  fr: "Personnes",
  it: "Persone",
  tr: "Kişi",
  ar: "أشخاص",
  zh: "人数",
};

function reservationDetails(
  payload: Record<string, unknown>,
  timeZone: string | undefined,
  copy: StaffNotificationCopy,
  locale: string,
): string {
  const guest = pickString(payload.guestLabel) ?? copy.guest;
  const party = pickNumber(payload.partySize);
  const when = formatPushDateTime(payload.startsAt, timeZone, locale);
  const number = pickNumber(payload.reservationNumber);
  const phone = pickString(payload.guestPhone);
  const email = pickString(payload.guestEmail);
  const notes = pickString(payload.notesPreview);
  const messagePreview = pickString(payload.messagePreview);
  const people = PEOPLE_LABEL[normalizeAppLocale(locale)] ?? PEOPLE_LABEL.de;

  return detailLines([
    `${copy.guest}: ${guest}`,
    party != null ? `${people}: ${party}` : null,
    when ? `${copy.appointment}: ${when}` : null,
    number != null ? `${copy.reservationNo} ${number}` : null,
    phone ? `${copy.phone}: ${phone}` : null,
    email ? `${copy.email}: ${email}` : null,
    notes ? `${copy.note}: ${notes}` : null,
    messagePreview ? `${copy.message}: ${messagePreview}` : null,
  ]);
}

export function buildNotificationPushText(
  event: NotificationEventRow,
  restaurantName: string | null,
  timeZone?: string,
  locale?: string | null,
): NotificationPushMessageResult {
  const unitLocale = resolveInventoryNotificationLocale(locale, null);
  const c = staffNotificationCopy(unitLocale);
  const prefix = restaurantName ? `${restaurantName}: ` : "";
  const moduleDef = NOTIFICATION_MODULES[event.module];
  const href = absoluteAppUrl(moduleDef.href);
  const p = event.payload;

  switch (event.module) {
    case "messages": {
      const subjectName = messagePushSubjectName(p, c);
      const platformCode = pickString(p.platform)?.toLowerCase() ?? null;
      const platform = platformLabel(p.platform, unitLocale);
      const when = formatPushDateTime(p.messageCreatedAt, timeZone, unitLocale);
      const preview = quotePreview(p.preview);
      return buildPushMessage({
        prefix,
        headline: c.newMessage,
        subject: `${prefix}${c.newMessage} — ${subjectName}`,
        href,
        platformCode,
        details: detailLines([
          ...messageSenderDetailLines(p, c),
          platform ? `${c.channel}: ${platform}` : null,
          when ? `${c.received}: ${when}` : null,
          preview,
        ]),
      });
    }
    case "messages_follow_up": {
      const contactName = pickString(p.contactName) ?? c.messageFallback;
      const reason = pickString(p.reason);
      const when = formatPushDateTime(p.remindAt, timeZone, unitLocale);
      const followHref = pickString(p.href);
      return buildPushMessage({
        prefix,
        headline: c.followUpDue,
        subject: `${prefix}${c.later} — ${contactName}`,
        href: followHref
          ? absoluteAppUrl(followHref)
          : absoluteAppUrl(moduleDef.href),
        details: detailLines([
          `${c.chat}: ${contactName}`,
          reason ? `${c.reason}: ${reason}` : null,
          when ? `${c.due}: ${when}` : null,
        ]),
      });
    }
    case "reviews": {
      const author = pickString(p.authorName) ?? c.guest;
      const rating = pickNumber(p.rating);
      const stars = rating != null && rating > 0 ? formatRatingStars(rating) : null;
      const platform = platformLabel(p.platform, unitLocale);
      const when = formatPushDateTime(p.reviewCreatedAt, timeZone, unitLocale);
      const preview = quotePreview(p.commentPreview);
      const ratingLine =
        stars != null
          ? `${c.rating}: ${stars}${rating != null ? ` (${Math.round(rating)}/5)` : ""}`
          : null;
      return buildPushMessage({
        prefix,
        headline: platform ? `${c.newReview} (${platform})` : c.newReview,
        subject: `${prefix}${c.newReview}${rating != null && rating > 0 ? ` — ${Math.round(rating)}★` : ""}`,
        href,
        details: detailLines([
          `${c.from}: ${author}`,
          ratingLine,
          when ? `${c.reviewedOn}: ${when}` : null,
          preview,
        ]),
      });
    }
    case "reservations_pending": {
      const guest = pickString(p.guestLabel) ?? c.guest;
      return buildPushMessage({
        prefix,
        headline: c.newPendingReservation,
        subject: `${prefix}${c.newReservation} — ${guest}`,
        href,
        details: reservationDetails(p, timeZone, c, unitLocale),
      });
    }
    case "reservations_change_request": {
      const guest = pickString(p.guestLabel) ?? c.guest;
      return buildPushMessage({
        prefix,
        headline: c.changeRequest,
        subject: `${prefix}${c.changeRequestShort} — ${guest}`,
        href,
        details: reservationDetails(p, timeZone, c, unitLocale),
      });
    }
    case "reservations_cancellation": {
      const guest = pickString(p.guestLabel) ?? c.guest;
      return buildPushMessage({
        prefix,
        headline: c.cancellation,
        subject: `${prefix}${c.cancellationShort} — ${guest}`,
        href,
        details: reservationDetails(p, timeZone, c, unitLocale),
      });
    }
    case "events_inquiry": {
      const guest = pickString(p.guestLabel) ?? c.guest;
      const company = pickString(p.guestCompany);
      return buildPushMessage({
        prefix,
        headline: c.eventInquiry,
        subject: `${prefix}${c.eventInquiryShort} — ${guest}`,
        href,
        details: detailLines([
          company ? `${c.company}: ${company}` : null,
          reservationDetails(p, timeZone, c, unitLocale),
        ]),
      });
    }
    case "staff_shift_start": {
      const staffName = pickString(p.staffName) ?? c.staffFallback;
      const label = pickString(p.label);
      const start = formatPushTime(p.startsAt, timeZone, unitLocale);
      const end = formatPushTime(p.endsAt, timeZone, unitLocale);
      const timeRange =
        start && end ? clockLabel(`${start}–${end}`, c) : start ? clockLabel(start, c) : null;
      const startAtLabel = formatPushDateTime(p.startsAt, timeZone, unitLocale);
      return buildPushMessage({
        prefix,
        headline: c.shiftStart,
        subject: `${prefix}${c.shiftStart} — ${staffName}`,
        href,
        details: detailLines([
          `${c.staff}: ${staffName}`,
          label ? `${c.shift}: ${label}` : null,
          timeRange ? `${c.time}: ${timeRange}` : null,
          startAtLabel ? `${c.start}: ${startAtLabel}` : null,
        ]),
      });
    }
    case "staff_shift_end": {
      const staffName = pickString(p.staffName) ?? c.staffFallback;
      const label = pickString(p.label);
      const start = formatPushTime(p.startsAt, timeZone, unitLocale);
      const end = formatPushTime(p.endsAt, timeZone, unitLocale);
      const timeRange =
        start && end ? clockLabel(`${start}–${end}`, c) : end ? clockLabel(end, c) : null;
      const endAtLabel = formatPushDateTime(p.endsAt, timeZone, unitLocale);
      return buildPushMessage({
        prefix,
        headline: c.shiftEnd,
        subject: `${prefix}${c.shiftEnd} — ${staffName}`,
        href,
        details: detailLines([
          `${c.staff}: ${staffName}`,
          label ? `${c.shift}: ${label}` : null,
          timeRange ? `${c.planned}: ${timeRange}` : null,
          endAtLabel ? `${c.end}: ${endAtLabel}` : null,
        ]),
      });
    }
    case "inventory_low_stock": {
      const name = pickString(p.ingredientName) ?? c.ingredientFallback;
      const stock = formatStockAmount(p.currentStock);
      const threshold = formatStockAmount(p.lowStockThreshold);
      const unit = localizedUnit(pickString(p.unit), unitLocale);
      const unitText = unit ? ` ${unit}` : "";
      return buildPushMessage({
        prefix,
        headline: c.lowStock,
        subject: `${prefix}${c.lowStock} — ${name}`,
        href,
        details: detailLines([
          `${c.ingredient}: ${name}`,
          `${c.stock}: ${stock}${unitText}`,
          `${c.threshold}: ${threshold}${unitText}`,
        ]),
      });
    }
    case "inventory_po_delivery_due": {
      const supplier = pickString(p.supplierName) ?? c.supplierFallback;
      const deliveryDate = pickString(p.deliveryDate);
      const kind = pickString(p.kind);
      const kindLabel =
        kind === "overdue" ? c.overdue : c.deliveryToday;
      return buildPushMessage({
        prefix,
        headline: kindLabel,
        subject: `${prefix}${kindLabel} — ${supplier}`,
        href,
        details: detailLines([
          `${c.supplier}: ${supplier}`,
          deliveryDate ? `${c.deliveryDate}: ${deliveryDate}` : null,
          c.checkDelivery,
        ]),
      });
    }
    case "inventory_po_ordered":
    case "inventory_po_closed": {
      const supplier = pickString(p.supplierName) ?? c.supplierFallback;
      const ordered = event.module === "inventory_po_ordered";
      const headline = ordered
        ? c.poOrdered
        : c.poClosed;
      const poLines = parsePoStatusLines(p.lines).map((line) => ({
        ...line,
        unitLabel: line.unitLabel
          ? localizedUnit(line.unitLabel, unitLocale)
          : null,
      }));
      const poCopy = {
        module: event.module,
        supplierName: supplier,
        deliveryDate: p.deliveryDate,
        staffName: pickString(p.staffName),
        lines: poLines,
      };
      return buildPushMessage({
        prefix,
        headline,
        subject: `${prefix}${headline} — ${supplier}`,
        href,
        details: formatPoStatusPushDetails(poCopy),
        emailBodyHtml: formatPoStatusEmailBodyHtml(poCopy),
      });
    }
    case "digest_daily_preview":
    case "digest_daily_review":
    case "digest_weekly_preview":
    case "digest_weekly_review": {
      return buildPushMessage({
        prefix,
        headline: moduleNoticeLabel(event.module, unitLocale),
        subject: `${prefix}${moduleNoticeLabel(event.module, unitLocale)}`,
        href,
        details: digestPushDetails(p),
      });
    }
    case "inventory_stock_activity": {
      const name = pickString(p.ingredientName);
      const unit = localizedUnit(
        pickString(p.unitLabel) ?? pickString(p.unit),
        unitLocale,
      );
      const from = pickQuantity(p.fromQuantity);
      const to = pickQuantity(p.toQuantity);
      const change =
        from != null && to != null
          ? `${quantityWithUnit(from, unit, unitLocale)} → ${quantityWithUnit(to, unit, unitLocale)}`
          : to != null
            ? quantityWithUnit(to, unit, unitLocale)
            : from != null
              ? quantityWithUnit(from, unit, unitLocale)
              : null;
      return buildPushMessage({
        prefix,
        headline: c.stockChange,
        subject: `${prefix}${c.stockChange}${name ? ` — ${name}` : ""}`,
        href,
        details: detailLines([
          name ? `${c.ingredient}: ${name}` : null,
          change,
        ]),
      });
    }
    case "inventory_po_activity":
    case "reservations_activity":
      return buildPushMessage({
        prefix,
        headline: moduleNoticeLabel(event.module, unitLocale),
        subject: `${prefix}${moduleNoticeLabel(event.module, unitLocale)}`,
        href,
        details: detailLines([]),
      });
    case "accounting_quotation": {
      const title = pickString(p.title) ?? c.quoteFallback;
      const number = pickString(p.voucherNumber);
      const recipient = pickString(p.recipientLabel);
      const amount = pickString(p.amountLabel);
      return buildPushMessage({
        prefix,
        headline: c.newQuote,
        subject: `${prefix}${c.newQuote}${number ? ` — ${number}` : ""}`,
        href,
        details: detailLines([
          `${c.title}: ${title}`,
          number ? `${c.number}: ${number}` : null,
          recipient ? `${c.recipient}: ${recipient}` : null,
          amount ? `${c.amount}: ${amount}` : null,
        ]),
      });
    }
    case "accounting_invoice": {
      const title = pickString(p.title) ?? c.invoiceFallback;
      const number = pickString(p.voucherNumber);
      const recipient = pickString(p.recipientLabel);
      const amount = pickString(p.amountLabel);
      return buildPushMessage({
        prefix,
        headline: c.newInvoice,
        subject: `${prefix}${c.newInvoice}${number ? ` — ${number}` : ""}`,
        href,
        details: detailLines([
          `${c.title}: ${title}`,
          number ? `${c.number}: ${number}` : null,
          recipient ? `${c.recipient}: ${recipient}` : null,
          amount ? `${c.amount}: ${amount}` : null,
        ]),
      });
    }
    case "accounting_voucher": {
      const contact = pickString(p.contactName) ?? c.voucherFallback;
      const number = pickString(p.voucherNumber);
      const amount = pickString(p.amountLabel);
      const headline = voucherNoticeHeadline(
        p.source,
        moduleNoticeLabel("accounting_voucher", unitLocale, "one"),
        c.newVoucher,
      );
      return buildPushMessage({
        prefix,
        headline,
        subject: `${prefix}${headline}${number ? ` — ${number}` : ""}`,
        href,
        details: detailLines([
          voucherUploadedAtLexofficeLine(p.source, unitLocale),
          contact ? `${c.contact}: ${contact}` : null,
          number ? `${c.number}: ${number}` : null,
          amount ? `${c.amount}: ${amount}` : null,
        ]),
      });
    }
    case "staff_todo_completed": {
      const title = pickString(p.todoTitle) ?? c.todoFallback;
      return buildPushMessage({
        prefix,
        headline: c.todoDone,
        subject: `${prefix}${c.todoDone} — ${title}`,
        href,
        details: detailLines([`${c.task}: ${title}`]),
      });
    }
    case "staff_todo_deferred": {
      const title = pickString(p.todoTitle) ?? c.todoFallback;
      const details =
        p.details && typeof p.details === "object"
          ? (p.details as Record<string, unknown>)
          : null;
      const reason = pickString(details?.reason) ?? pickString(p.reason);
      return buildPushMessage({
        prefix,
        headline: c.todoDeferred,
        subject: `${prefix}${c.todoDeferred} — ${title}`,
        href,
        details: detailLines([
          `${c.task}: ${title}`,
          reason ? `${c.reason}: ${reason}` : null,
        ]),
      });
    }
    case "personal_reminder": {
      const title = pickString(p.title) ?? c.reminder;
      return buildPushMessage({
        prefix,
        headline: c.personalReminder,
        subject: `${prefix}${c.reminder} — ${title}`,
        href: "/dashboard/tasks/mine",
        details: detailLines([title, pickString(p.body)]),
      });
    }
    case "staff_messages": {
      const peer = pickString(p.peerName) ?? c.colleague;
      const preview = pickString(p.preview) ?? c.newMessageShort;
      return buildPushMessage({
        prefix,
        headline: c.teamMessage,
        subject: `${prefix}${c.message} ${peer}`,
        href: "/dashboard/tasks/messages",
        details: detailLines([`${peer}: ${preview}`]),
      });
    }
    case "staff_contract_signed": {
      const title = pickString(p.contractTitle) ?? c.contractFallback;
      const revised = p.revised === true;
      const pending = p.pendingEmployeeSignature === true;
      return buildPushMessage({
        prefix,
        headline: pending
          ? c.contractSign
          : revised
            ? c.contractRevised
            : c.newContract,
        subject: `${prefix}${
          pending
            ? c.contractSign
            : revised
              ? c.contractRevised
              : c.newContract
        } — ${title}`,
        href: APP_ROUTES.profile.documents,
        details: detailLines([
          title,
          pending
            ? c.contractSignHint
            : c.contractViewHint,
        ]),
      });
    }
    case "staff_document_assigned": {
      const title = pickString(p.documentTitle) ?? c.documentFallback;
      return buildPushMessage({
        prefix,
        headline: c.newDocument,
        subject: `${prefix}${c.newDocument} — ${title}`,
        href: APP_ROUTES.profile.documents,
        details: detailLines([
          title,
          c.contractViewHint,
        ]),
      });
    }
    case "staff_display_time_request": {
      const time = pickString(p.requestedStartsAt);
      const end = pickString(p.requestedEndsAt);
      const entryType = pickString(p.entryType);
      const fromLabel = formatPushTime(time, timeZone, unitLocale);
      const toLabel = formatPushTime(end, timeZone, unitLocale);
      return buildPushMessage({
        prefix,
        headline: c.timeCorrection,
        subject: `${prefix}${c.timeCorrectionSubject}`,
        href,
        details: detailLines([
          entryType ? `${c.kind}: ${entryType}` : null,
          fromLabel && toLabel
            ? `${c.period}: ${fromLabel} – ${toLabel}`
            : fromLabel
              ? `${c.begin}: ${fromLabel}`
              : null,
          c.pleaseApprove,
        ]),
      });
    }
    case "staff_display_clock_in":
    case "staff_display_clock_out":
    case "staff_display_break_start":
    case "staff_display_break_end": {
      const staffName = pickString(p.staffName) ?? c.staffFallback;
      const at = pickString(p.at);
      const staffId = pickString(p.staffId);
      const autoClockOut =
        event.module === "staff_display_clock_out" && p.auto === true;
      const clockHref = absoluteAppUrl(
        staffId
          ? `${moduleDef.href}?staff=${encodeURIComponent(staffId)}`
          : moduleDef.href,
      );
      const atLabel = formatPushTime(at, timeZone, unitLocale);
      const headline =
        event.module === "staff_display_clock_in"
          ? c.displayClockIn
          : event.module === "staff_display_break_start"
            ? c.displayBreakStart
            : event.module === "staff_display_break_end"
              ? c.displayBreakEnd
              : autoClockOut
                ? c.displayAutoOut
                : c.displayClockOut;
      return buildPushMessage({
        prefix,
        headline,
        subject: `${prefix}${headline} — ${staffName}`,
        href: clockHref,
        details: detailLines([
          staffName,
          autoClockOut ? c.autoOutHint : null,
          atLabel ? `${c.clockTime}: ${atLabel}` : null,
        ]),
      });
    }
    case "staff_invite_accepted": {
      const staffName = pickString(p.staffName) ?? c.staffFallback;
      const positionName = pickString(p.positionName);
      const actorGiven = pickString(p.actorGivenName) ?? "";
      const actorFamily = pickString(p.actorFamilyName) ?? "";
      const actor = `${actorGiven} ${actorFamily}`.trim() || staffName;
      const staffId = pickString(p.staffId);
      const inviteHref = absoluteAppUrl(
        staffId
          ? `${moduleDef.href}?staff=${encodeURIComponent(staffId)}`
          : moduleDef.href,
      );
      return buildPushMessage({
        prefix,
        headline: c.inviteAccepted,
        subject: `${prefix}${c.inviteAccepted} — ${staffName}`,
        href: inviteHref,
        details: detailLines([
          c.fillName(c.inviteAcceptedLine, actor),
          `${c.staff}: ${staffName}`,
          positionName ? `${c.appRole}: ${positionName}` : null,
        ]),
      });
    }
    case "staff_invite_declined": {
      const staffName = pickString(p.staffName) ?? c.staffFallback;
      const positionName = pickString(p.positionName);
      const actorGiven = pickString(p.actorGivenName) ?? "";
      const actorFamily = pickString(p.actorFamilyName) ?? "";
      const actor = `${actorGiven} ${actorFamily}`.trim() || staffName;
      const staffId = pickString(p.staffId);
      const inviteHref = absoluteAppUrl(
        staffId
          ? `${moduleDef.href}?staff=${encodeURIComponent(staffId)}`
          : moduleDef.href,
      );
      return buildPushMessage({
        prefix,
        headline: c.inviteDeclined,
        subject: `${prefix}${c.inviteDeclined} — ${staffName}`,
        href: inviteHref,
        details: detailLines([
          c.fillName(c.inviteDeclinedLine, actor),
          `${c.staff}: ${staffName}`,
          positionName ? `${c.appRole}: ${positionName}` : null,
        ]),
      });
    }
    case "staff_permissions_granted": {
      const labels = Array.isArray(p.permissionLabels)
        ? p.permissionLabels.filter((v): v is string => typeof v === "string")
        : [];
      const positionName = pickString(p.positionName);
      const preview =
        labels.length === 0
          ? c.newModuleRights
          : labels.length <= 3
            ? labels.join(", ")
            : `${labels.slice(0, 3).join(", ")} +${labels.length - 3}`;
      return buildPushMessage({
        prefix,
        headline: c.newRights,
        subject: `${prefix}${c.newRights}`,
        href: absoluteAppUrl(moduleDef.href),
        details: detailLines([
          preview,
          positionName ? `${c.role}: ${positionName}` : null,
          c.openDashboard,
        ]),
      });
    }
    case "changelog": {
      const title = pickString(p.title) ?? c.changelog;
      const version = pickString(p.version);
      const when = formatPushDateTime(p.publishedAt, timeZone, unitLocale);
      return buildPushMessage({
        prefix: "",
        headline: c.changelogNew,
        subject: `${c.changelog}: ${title}`,
        href,
        details: detailLines([
          `${c.title}: ${title}`,
          version ? `${c.version}: ${version}` : null,
          when ? `${c.published}: ${when}` : null,
        ]),
      });
    }
  }
}
