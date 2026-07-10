import { DEFAULT_RESTAURANT_TIMEZONE } from "@/lib/restaurant/restaurant-timezone";
import type { ReservationMessageContext } from "@/lib/whatsapp/reservation-message-templates";

/** Sofortnachrichten + geplante Erinnerung/Danke. */
export const WHATSAPP_MESSAGE_KINDS = [
  "received",
  "confirmed",
  "reminder",
  "thanks",
  "cancelled",
  "declined",
  "no_show",
] as const;

export type WhatsappMessageKind = (typeof WHATSAPP_MESSAGE_KINDS)[number];

export const WHATSAPP_IMMEDIATE_KINDS = [
  "received",
  "confirmed",
  "cancelled",
  "declined",
  "no_show",
] as const;

export type WhatsappImmediateKind = (typeof WHATSAPP_IMMEDIATE_KINDS)[number];

export const WHATSAPP_PLACEHOLDER_HINTS: ReadonlyArray<{
  key: string;
  label: string;
}> = [
  { key: "{anrede}", label: "Hallo Vorname Nachname" },
  { key: "{vorname}", label: "Vorname" },
  { key: "{nachname}", label: "Nachname" },
  { key: "{datum}", label: "dd.mm.yyyy" },
  { key: "{uhrzeit}", label: "HH:MM" },
  { key: "{personen}", label: "Personenzahl" },
  { key: "{nummer}", label: "Reservierungsnummer" },
  { key: "{pin}", label: "Gast-PIN" },
  {
    key: "{link}",
    label: "Änderungs-Link (wenn in Einstellungen hinterlegt)",
  },
];

export const DEFAULT_WHATSAPP_TEMPLATES: Record<WhatsappMessageKind, string> = {
  received: `{anrede},

deine Reservierung ist bei uns eingegangen und wird überprüft.

📅 Datum: {datum}
🕞 {uhrzeit} Uhr
👤 {personen} Personen

Reservierungsnummer: #{nummer}
PIN: {pin}{link}`,

  confirmed: `{anrede},

deine Reservierung wurde bestätigt ✅

📅 Datum: {datum}
🕞 {uhrzeit} Uhr
👤 {personen} Personen

Reservierungsnummer: #{nummer}
PIN: {pin}{link}`,

  reminder: `{anrede},

kurze Erinnerung an deine Reservierung bei uns:

📅 {datum}
🕞 {uhrzeit} Uhr
👤 {personen} Personen

Wir freuen uns auf dich!{link}`,

  thanks: `{anrede},

vielen Dank für deinen Besuch! Wir hoffen, es hat dir bei uns gefallen.

Wenn du magst, freuen wir uns über eine kurze Bewertung ⭐{link}`,

  cancelled: `{anrede},

deine Reservierung wurde storniert.

📅 Datum: {datum}
🕞 {uhrzeit} Uhr
👤 {personen} Personen

Reservierungsnummer: #{nummer}
PIN: {pin}{link}`,

  declined: `{anrede},

leider können wir deine Reservierung am {datum} um {uhrzeit} Uhr nicht annehmen (Absage).

Reservierungsnummer: #{nummer}
PIN: {pin}{link}`,

  no_show: `{anrede},

schade, dass du deinen Termin am {datum} um {uhrzeit} Uhr nicht wahrgenommen hast. Melde dich gerne, wenn du einen neuen Termin möchtest.

Reservierungsnummer: #{nummer}
PIN: {pin}{link}`,
};

export type WhatsappTemplateSettings = {
  whatsapp_received_template: string | null;
  whatsapp_confirmed_template: string | null;
  whatsapp_reminder_template: string | null;
  whatsapp_thanks_template: string | null;
  whatsapp_cancelled_template: string | null;
  whatsapp_declined_template: string | null;
  whatsapp_no_show_template: string | null;
};

const TEMPLATE_COLUMN: Record<WhatsappMessageKind, keyof WhatsappTemplateSettings> = {
  received: "whatsapp_received_template",
  confirmed: "whatsapp_confirmed_template",
  reminder: "whatsapp_reminder_template",
  thanks: "whatsapp_thanks_template",
  cancelled: "whatsapp_cancelled_template",
  declined: "whatsapp_declined_template",
  no_show: "whatsapp_no_show_template",
};

export function resolveWhatsappTemplate(
  settings: WhatsappTemplateSettings | null | undefined,
  kind: WhatsappMessageKind,
): string {
  const custom = settings?.[TEMPLATE_COLUMN[kind]]?.trim();
  return custom || DEFAULT_WHATSAPP_TEMPLATES[kind];
}

function formatDateDe(d: Date, timeZone: string): string {
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  });
}

function formatTimeDe(d: Date, timeZone: string): string {
  return d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });
}

function guestGreeting(ctx: ReservationMessageContext): string {
  const fn = ctx.guestFirstName.trim();
  const ln = ctx.guestLastName.trim();
  const name = `${fn} ${ln}`.trim();
  return name ? `Hallo ${name}` : "Hallo";
}

function linkSuffix(ctx: ReservationMessageContext): string {
  if (!ctx.manageUrl) return "";
  return `\n\n✏️ Reservierung ändern:\n${ctx.manageUrl}`;
}

export function renderWhatsappMessageTemplate(
  template: string,
  ctx: ReservationMessageContext,
): string {
  const timeZone = ctx.timeZone?.trim() || DEFAULT_RESTAURANT_TIMEZONE;
  const replacements: Record<string, string> = {
    "{anrede}": guestGreeting(ctx),
    "{vorname}": ctx.guestFirstName.trim(),
    "{nachname}": ctx.guestLastName.trim(),
    "{datum}": formatDateDe(ctx.startsAt, timeZone),
    "{uhrzeit}": formatTimeDe(ctx.startsAt, timeZone),
    "{personen}": String(ctx.partySize),
    "{nummer}": String(ctx.reservationNumber),
    "{pin}": ctx.guestPin,
    "{link}": linkSuffix(ctx),
    "{ANREDE}": guestGreeting(ctx),
    "{VORNAME}": ctx.guestFirstName.trim(),
    "{NACHNAME}": ctx.guestLastName.trim(),
    "{DATUM}": formatDateDe(ctx.startsAt, timeZone),
    "{UHRZEIT}": formatTimeDe(ctx.startsAt, timeZone),
    "{PERSONEN}": String(ctx.partySize),
    "{NUMMER}": String(ctx.reservationNumber),
    "{PIN}": ctx.guestPin,
    "{LINK}": linkSuffix(ctx),
  };

  let out = template;
  for (const [key, value] of Object.entries(replacements)) {
    out = out.split(key).join(value);
  }
  return out.replace(/\r\n/g, "\n").trim();
}

export function buildWhatsappMessage(
  settings: WhatsappTemplateSettings | null | undefined,
  kind: WhatsappMessageKind,
  ctx: ReservationMessageContext,
): string {
  const template = resolveWhatsappTemplate(settings, kind);
  return renderWhatsappMessageTemplate(template, ctx);
}

export type EmailTemplateSettings = {
  email_sender_name?: string | null;
  email_received_template: string | null;
  email_confirmed_template: string | null;
  email_reminder_template: string | null;
  email_thanks_template: string | null;
  email_cancelled_template: string | null;
  email_declined_template: string | null;
  email_no_show_template: string | null;
  email_received_subject?: string | null;
  email_confirmed_subject?: string | null;
  email_reminder_subject?: string | null;
  email_thanks_subject?: string | null;
  email_cancelled_subject?: string | null;
  email_declined_subject?: string | null;
  email_no_show_subject?: string | null;
};

const EMAIL_TEMPLATE_COLUMN: Record<
  WhatsappMessageKind,
  keyof Pick<
    EmailTemplateSettings,
    | "email_received_template"
    | "email_confirmed_template"
    | "email_reminder_template"
    | "email_thanks_template"
    | "email_cancelled_template"
    | "email_declined_template"
    | "email_no_show_template"
  >
> = {
  received: "email_received_template",
  confirmed: "email_confirmed_template",
  reminder: "email_reminder_template",
  thanks: "email_thanks_template",
  cancelled: "email_cancelled_template",
  declined: "email_declined_template",
  no_show: "email_no_show_template",
};

const EMAIL_SUBJECT_COLUMN: Record<
  WhatsappMessageKind,
  keyof Pick<
    EmailTemplateSettings,
    | "email_received_subject"
    | "email_confirmed_subject"
    | "email_reminder_subject"
    | "email_thanks_subject"
    | "email_cancelled_subject"
    | "email_declined_subject"
    | "email_no_show_subject"
  >
> = {
  received: "email_received_subject",
  confirmed: "email_confirmed_subject",
  reminder: "email_reminder_subject",
  thanks: "email_thanks_subject",
  cancelled: "email_cancelled_subject",
  declined: "email_declined_subject",
  no_show: "email_no_show_subject",
};

export const DEFAULT_EMAIL_SUBJECT_BY_KIND: Record<WhatsappMessageKind, string> = {
  received: "Deine Reservierung ist eingegangen (#{nummer})",
  confirmed: "Deine Reservierung wurde bestätigt (#{nummer})",
  reminder: "Erinnerung an deine Reservierung (#{nummer})",
  thanks: "Danke für deinen Besuch",
  cancelled: "Deine Reservierung wurde storniert (#{nummer})",
  declined: "Zu deiner Reservierungsanfrage (#{nummer})",
  no_show: "Zu deinem Reservierungstermin (#{nummer})",
};

/** @deprecated — nutze DEFAULT_EMAIL_SUBJECT_BY_KIND / buildEmailSubject */
export const EMAIL_SUBJECT_BY_KIND: Record<WhatsappMessageKind, string> = {
  received: "Deine Reservierung ist eingegangen",
  confirmed: "Deine Reservierung wurde bestätigt",
  reminder: "Erinnerung an deine Reservierung",
  thanks: "Danke für deinen Besuch",
  cancelled: "Deine Reservierung wurde storniert",
  declined: "Zu deiner Reservierungsanfrage",
  no_show: "Zu deinem Reservierungstermin",
};

export function resolveEmailTemplate(
  settings: EmailTemplateSettings | null | undefined,
  kind: WhatsappMessageKind,
): string {
  const custom = settings?.[EMAIL_TEMPLATE_COLUMN[kind]]?.trim();
  return custom || DEFAULT_WHATSAPP_TEMPLATES[kind];
}

export function buildEmailMessage(
  settings: EmailTemplateSettings | null | undefined,
  kind: WhatsappMessageKind,
  ctx: ReservationMessageContext,
): string {
  const template = resolveEmailTemplate(settings, kind);
  return renderWhatsappMessageTemplate(template, ctx);
}

export function resolveEmailSubject(
  settings: EmailTemplateSettings | null | undefined,
  kind: WhatsappMessageKind,
): string {
  const custom = settings?.[EMAIL_SUBJECT_COLUMN[kind]]?.trim();
  return custom || DEFAULT_EMAIL_SUBJECT_BY_KIND[kind];
}

export function buildEmailSubject(
  settings: EmailTemplateSettings | null | undefined,
  kind: WhatsappMessageKind,
  ctx: ReservationMessageContext,
): string {
  const template = resolveEmailSubject(settings, kind);
  return renderWhatsappMessageTemplate(template, ctx).replace(/\s+/g, " ").trim();
}

/** Anzeigename im From-Header; leer = Fallback aus SMTP-Integration / Restaurant. */
export function resolveEmailSenderDisplayName(
  settings: EmailTemplateSettings | null | undefined,
  fallbackName: string,
): string {
  const name = settings?.email_sender_name?.trim();
  return name || fallbackName;
}

export function emailSubjectFormValueFromDb(
  stored: string | null | undefined,
  kind: WhatsappMessageKind,
): string {
  const t = stored?.trim();
  return t ? stored! : DEFAULT_EMAIL_SUBJECT_BY_KIND[kind];
}

export function emailSubjectFormValueToDb(
  formValue: string,
  kind: WhatsappMessageKind,
): string | null {
  const trimmed = formValue.trim();
  if (!trimmed) return null;
  if (trimmed === DEFAULT_EMAIL_SUBJECT_BY_KIND[kind].trim()) return null;
  return trimmed;
}

export function validateEmailSubject(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Betreff darf nicht leer sein.";
  if (trimmed.length > 300) {
    return "Betreff ist zu lang (max. 300 Zeichen).";
  }
  return null;
}

export function validateEmailSenderName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 120) {
    return "Absendername ist zu lang (max. 120 Zeichen).";
  }
  return null;
}

/** @deprecated — nutze buildEmailSubject */
export function emailSubjectForKind(
  kind: WhatsappMessageKind,
  reservationNumber: number,
): string {
  return `${EMAIL_SUBJECT_BY_KIND[kind]} (#${reservationNumber})`;
}

export function validateWhatsappMessageTemplate(
  value: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 4000) {
    return "Text ist zu lang (max. 4000 Zeichen).";
  }
  return null;
}

/** Leer in der DB → vollständige Standardvorlage im Formular. */
export function templateFormValueFromDb(
  stored: string | null | undefined,
  kind: WhatsappMessageKind,
): string {
  const t = stored?.trim();
  return t ? stored! : DEFAULT_WHATSAPP_TEMPLATES[kind];
}

/** Unveränderte Standardvorlage → null in der DB (weiterhin Standard bei Versand). */
export function templateFormValueToDb(
  formValue: string,
  kind: WhatsappMessageKind,
): string | null {
  const trimmed = formValue.trim();
  if (!trimmed) return null;
  if (trimmed === DEFAULT_WHATSAPP_TEMPLATES[kind].trim()) return null;
  return trimmed;
}
