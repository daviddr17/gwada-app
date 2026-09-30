import { APP_LOCALE_TO_PROFILE, normalizeAppLocale, type AppLocale } from "@/i18n/config";
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
  { key: "{datum}", label: "Di., 14.07.26" },
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
  locale?: string | null,
): string {
  const custom = settings?.[TEMPLATE_COLUMN[kind]]?.trim();
  return custom || defaultGuestTemplate(kind, locale);
}

function guestLocale(ctx: ReservationMessageContext): AppLocale {
  return normalizeAppLocale(ctx.locale);
}

/** Wie Manager-/Mitarbeiter-Slots: „Di., 14.07.26“ (Restaurant-Zeitzone). */
function formatDateForGuest(d: Date, timeZone: string, locale: AppLocale): string {
  return d.toLocaleDateString(APP_LOCALE_TO_PROFILE[locale], {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone,
  });
}

function formatTimeForGuest(d: Date, timeZone: string, locale: AppLocale): string {
  return d.toLocaleTimeString(APP_LOCALE_TO_PROFILE[locale], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });
}

const HELLO: Record<AppLocale, string> = {
  de: "Hallo",
  en: "Hello",
  es: "Hola",
  fr: "Bonjour",
  it: "Ciao",
  tr: "Merhaba",
  ar: "مرحباً",
  zh: "你好",
};

const CHANGE_LINK: Record<AppLocale, string> = {
  de: "Reservierung ändern",
  en: "Change reservation",
  es: "Cambiar la reserva",
  fr: "Modifier la réservation",
  it: "Modifica la prenotazione",
  tr: "Rezervasyonu değiştir",
  ar: "تعديل الحجز",
  zh: "修改预订",
};

function guestGreeting(ctx: ReservationMessageContext): string {
  const fn = ctx.guestFirstName.trim();
  const ln = ctx.guestLastName.trim();
  const name = `${fn} ${ln}`.trim();
  const hello = HELLO[guestLocale(ctx)];
  return name ? `${hello} ${name}` : hello;
}

function linkSuffix(ctx: ReservationMessageContext): string {
  if (!ctx.manageUrl) return "";
  const label = CHANGE_LINK[guestLocale(ctx)];
  return `\n\n✏️ ${label}:\n${ctx.manageUrl}`;
}

export function renderWhatsappMessageTemplate(
  template: string,
  ctx: ReservationMessageContext,
): string {
  const timeZone = ctx.timeZone?.trim() || DEFAULT_RESTAURANT_TIMEZONE;
  const locale = guestLocale(ctx);
  const replacements: Record<string, string> = {
    "{anrede}": guestGreeting(ctx),
    "{vorname}": ctx.guestFirstName.trim(),
    "{nachname}": ctx.guestLastName.trim(),
    "{datum}": formatDateForGuest(ctx.startsAt, timeZone, locale),
    "{uhrzeit}": formatTimeForGuest(ctx.startsAt, timeZone, locale),
    "{personen}": String(ctx.partySize),
    "{nummer}": String(ctx.reservationNumber),
    "{pin}": ctx.guestPin,
    "{link}": linkSuffix(ctx),
    "{ANREDE}": guestGreeting(ctx),
    "{VORNAME}": ctx.guestFirstName.trim(),
    "{NACHNAME}": ctx.guestLastName.trim(),
    "{DATUM}": formatDateForGuest(ctx.startsAt, timeZone, locale),
    "{UHRZEIT}": formatTimeForGuest(ctx.startsAt, timeZone, locale),
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
  const template = resolveWhatsappTemplate(settings, kind, ctx.locale);
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

export function resolveEmailTemplate(
  settings: EmailTemplateSettings | null | undefined,
  kind: WhatsappMessageKind,
  locale?: string | null,
): string {
  const custom = settings?.[EMAIL_TEMPLATE_COLUMN[kind]]?.trim();
  return custom || defaultGuestTemplate(kind, locale);
}

export function buildEmailMessage(
  settings: EmailTemplateSettings | null | undefined,
  kind: WhatsappMessageKind,
  ctx: ReservationMessageContext,
): string {
  const template = resolveEmailTemplate(settings, kind, ctx.locale);
  return renderWhatsappMessageTemplate(template, ctx);
}

export function resolveEmailSubject(
  settings: EmailTemplateSettings | null | undefined,
  kind: WhatsappMessageKind,
  locale?: string | null,
): string {
  const custom = settings?.[EMAIL_SUBJECT_COLUMN[kind]]?.trim();
  return custom || defaultGuestSubject(kind, locale);
}

export function buildEmailSubject(
  settings: EmailTemplateSettings | null | undefined,
  kind: WhatsappMessageKind,
  ctx: ReservationMessageContext,
): string {
  const template = resolveEmailSubject(settings, kind, ctx.locale);
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

type GuestWords = {
  received: string;
  confirmed: string;
  reminder: string;
  thanks: string;
  cancelled: string;
  declined: string;
  noShow: string;
  people: string;
  number: string;
  pin: string;
  clock: string;
};

const GUEST_WORDS: Record<Exclude<AppLocale, "de">, GuestWords> = {
  en: {
    received: "your reservation has been received and is being checked.",
    confirmed: "your reservation is confirmed ✅",
    reminder: "a short reminder of your reservation:",
    thanks: "thank you for visiting. If you like, a short review would mean a lot ⭐",
    cancelled: "your reservation was cancelled.",
    declined: "we cannot accept your reservation on {datum} at {uhrzeit}.",
    noShow: "sorry you missed your reservation on {datum} at {uhrzeit}. You are welcome to book again.",
    people: "people",
    number: "Reservation number",
    pin: "PIN",
    clock: "",
  },
  es: {
    received: "hemos recibido tu reserva y la estamos revisando.",
    confirmed: "tu reserva está confirmada ✅",
    reminder: "un recordatorio de tu reserva:",
    thanks: "gracias por tu visita. Si quieres, nos alegra una reseña breve ⭐",
    cancelled: "tu reserva se ha cancelado.",
    declined: "no podemos aceptar tu reserva el {datum} a las {uhrzeit}.",
    noShow: "lamentamos que no vinieras el {datum} a las {uhrzeit}. Puedes reservar de nuevo cuando quieras.",
    people: "personas",
    number: "Número de reserva",
    pin: "PIN",
    clock: "",
  },
  fr: {
    received: "ta réservation est bien arrivée et va être vérifiée.",
    confirmed: "ta réservation est confirmée ✅",
    reminder: "un petit rappel de ta réservation :",
    thanks: "merci pour ta visite. Un court avis nous ferait plaisir ⭐",
    cancelled: "ta réservation a été annulée.",
    declined: "nous ne pouvons pas accepter ta réservation le {datum} à {uhrzeit}.",
    noShow: "dommage que tu n’aies pas pu venir le {datum} à {uhrzeit}. Tu peux réserver à nouveau.",
    people: "personnes",
    number: "Numéro de réservation",
    pin: "PIN",
    clock: "",
  },
  it: {
    received: "la tua prenotazione è arrivata e la stiamo controllando.",
    confirmed: "la tua prenotazione è confermata ✅",
    reminder: "un breve promemoria della tua prenotazione:",
    thanks: "grazie per la visita. Se vuoi, una breve recensione ci fa piacere ⭐",
    cancelled: "la tua prenotazione è stata annullata.",
    declined: "non possiamo accettare la prenotazione del {datum} alle {uhrzeit}.",
    noShow: "ci dispiace che tu non sia venuto il {datum} alle {uhrzeit}. Puoi prenotare di nuovo.",
    people: "persone",
    number: "Numero prenotazione",
    pin: "PIN",
    clock: "",
  },
  tr: {
    received: "rezervasyonun bize ulaştı ve kontrol ediliyor.",
    confirmed: "rezervasyonun onaylandı ✅",
    reminder: "rezervasyonun için kısa bir hatırlatma:",
    thanks: "ziyaretin için teşekkürler. İstersen kısa bir değerlendirme bizi sevindirir ⭐",
    cancelled: "rezervasyonun iptal edildi.",
    declined: "{datum} saat {uhrzeit} için rezervasyonunu kabul edemiyoruz.",
    noShow: "{datum} saat {uhrzeit} randevuna gelemedin. Yeniden rezervasyon yapabilirsin.",
    people: "kişi",
    number: "Rezervasyon numarası",
    pin: "PIN",
    clock: "",
  },
  ar: {
    received: "وصلنا حجزك وسنراجعه.",
    confirmed: "تم تأكيد حجزك ✅",
    reminder: "تذكير قصير بحجزك:",
    thanks: "شكراً لزيارتك. يسعدنا تقييم قصير إن رغبت ⭐",
    cancelled: "تم إلغاء حجزك.",
    declined: "لا يمكننا قبول حجزك في {datum} الساعة {uhrzeit}.",
    noShow: "نأسف لأنك لم تحضر في {datum} الساعة {uhrzeit}. يمكنك الحجز من جديد.",
    people: "أشخاص",
    number: "رقم الحجز",
    pin: "الرمز",
    clock: "",
  },
  zh: {
    received: "我们已收到你的预订，正在确认。",
    confirmed: "你的预订已确认 ✅",
    reminder: "提醒你即将到来的预订：",
    thanks: "感谢光临。如果方便，欢迎留一条简短评价 ⭐",
    cancelled: "你的预订已取消。",
    declined: "我们无法接受你在 {datum} {uhrzeit} 的预订。",
    noShow: "很遗憾你未在 {datum} {uhrzeit} 到店。欢迎再次预订。",
    people: "人",
    number: "预订号",
    pin: "PIN",
    clock: "",
  },
};

const SUBJECTS: Record<Exclude<AppLocale, "de">, Record<WhatsappMessageKind, string>> = {
  en: {
    received: "Your reservation was received (#{nummer})",
    confirmed: "Your reservation is confirmed (#{nummer})",
    reminder: "Reminder of your reservation (#{nummer})",
    thanks: "Thank you for visiting",
    cancelled: "Your reservation was cancelled (#{nummer})",
    declined: "About your reservation request (#{nummer})",
    no_show: "About your reservation (#{nummer})",
  },
  es: {
    received: "Hemos recibido tu reserva (#{nummer})",
    confirmed: "Tu reserva está confirmada (#{nummer})",
    reminder: "Recordatorio de tu reserva (#{nummer})",
    thanks: "Gracias por tu visita",
    cancelled: "Tu reserva se ha cancelado (#{nummer})",
    declined: "Sobre tu solicitud de reserva (#{nummer})",
    no_show: "Sobre tu reserva (#{nummer})",
  },
  fr: {
    received: "Ta réservation est bien arrivée (#{nummer})",
    confirmed: "Ta réservation est confirmée (#{nummer})",
    reminder: "Rappel de ta réservation (#{nummer})",
    thanks: "Merci pour ta visite",
    cancelled: "Ta réservation a été annulée (#{nummer})",
    declined: "Au sujet de ta demande (#{nummer})",
    no_show: "Au sujet de ta réservation (#{nummer})",
  },
  it: {
    received: "La tua prenotazione è arrivata (#{nummer})",
    confirmed: "La tua prenotazione è confermata (#{nummer})",
    reminder: "Promemoria della prenotazione (#{nummer})",
    thanks: "Grazie per la visita",
    cancelled: "La tua prenotazione è stata annullata (#{nummer})",
    declined: "Sulla tua richiesta (#{nummer})",
    no_show: "Sulla tua prenotazione (#{nummer})",
  },
  tr: {
    received: "Rezervasyonun ulaştı (#{nummer})",
    confirmed: "Rezervasyonun onaylandı (#{nummer})",
    reminder: "Rezervasyon hatırlatması (#{nummer})",
    thanks: "Ziyaretin için teşekkürler",
    cancelled: "Rezervasyonun iptal edildi (#{nummer})",
    declined: "Rezervasyon talebin hakkında (#{nummer})",
    no_show: "Rezervasyonun hakkında (#{nummer})",
  },
  ar: {
    received: "وصلنا حجزك (#{nummer})",
    confirmed: "تم تأكيد حجزك (#{nummer})",
    reminder: "تذكير بحجزك (#{nummer})",
    thanks: "شكراً لزيارتك",
    cancelled: "تم إلغاء حجزك (#{nummer})",
    declined: "بخصوص طلب الحجز (#{nummer})",
    no_show: "بخصوص حجزك (#{nummer})",
  },
  zh: {
    received: "我们已收到你的预订（#{nummer}）",
    confirmed: "你的预订已确认（#{nummer}）",
    reminder: "预订提醒（#{nummer}）",
    thanks: "感谢光临",
    cancelled: "你的预订已取消（#{nummer}）",
    declined: "关于你的预订请求（#{nummer}）",
    no_show: "关于你的预订（#{nummer}）",
  },
};

function localizedGuestBody(kind: WhatsappMessageKind, words: GuestWords): string {
  const when = `📅 {datum}\n🕞 {uhrzeit}${words.clock}\n👤 {personen} ${words.people}`;
  const ids = `\n\n${words.number}: #{nummer}\n${words.pin}: {pin}{link}`;
  switch (kind) {
    case "received":
      return `{anrede},\n\n${words.received}\n\n${when}${ids}`;
    case "confirmed":
      return `{anrede},\n\n${words.confirmed}\n\n${when}${ids}`;
    case "reminder":
      return `{anrede},\n\n${words.reminder}\n\n${when}{link}`;
    case "thanks":
      return `{anrede},\n\n${words.thanks}{link}`;
    case "cancelled":
      return `{anrede},\n\n${words.cancelled}\n\n${when}${ids}`;
    case "declined":
      return `{anrede},\n\n${words.declined}${ids}`;
    case "no_show":
      return `{anrede},\n\n${words.noShow}${ids}`;
  }
}

export function defaultGuestTemplate(
  kind: WhatsappMessageKind,
  locale?: string | null,
): string {
  const loc = normalizeAppLocale(locale);
  if (loc === "de") return DEFAULT_WHATSAPP_TEMPLATES[kind];
  return localizedGuestBody(kind, GUEST_WORDS[loc]);
}

export function defaultGuestSubject(
  kind: WhatsappMessageKind,
  locale?: string | null,
): string {
  const loc = normalizeAppLocale(locale);
  if (loc === "de") return DEFAULT_EMAIL_SUBJECT_BY_KIND[kind];
  return SUBJECTS[loc][kind];
}
