import type { AppLocale } from "../../i18n/config";

export const ASSISTANT_LIST_CAP = 8;

const ASK = {
  date: {
    de: "Für welchen Tag?",
    en: "Which day?",
    es: "¿Qué día?",
    fr: "Quel jour ?",
    it: "Quale giorno?",
    tr: "Hangi gün?",
    ar: "أي يوم؟",
    zh: "哪一天？",
  },
  time: {
    de: "Um wie viel Uhr?",
    en: "What time?",
    es: "¿A qué hora?",
    fr: "À quelle heure ?",
    it: "A che ora?",
    tr: "Saat kaçta?",
    ar: "في أي ساعة؟",
    zh: "几点？",
  },
  party: {
    de: "Für wie viele Personen?",
    en: "For how many people?",
    es: "¿Para cuántas personas?",
    fr: "Pour combien de personnes ?",
    it: "Per quante persone?",
    tr: "Kaç kişi?",
    ar: "لكم شخص؟",
    zh: "几位？",
  },
  guest: {
    de: "Auf welchen Namen?",
    en: "Under which name?",
    es: "¿A qué nombre?",
    fr: "À quel nom ?",
    it: "A che nome?",
    tr: "Hangi isimle?",
    ar: "بأي اسم؟",
    zh: "哪个名字？",
  },
  which: {
    de: "Welche davon meinst du?",
    en: "Which one do you mean?",
    es: "¿Cuál de estos quieres decir?",
    fr: "Lequel veux-tu dire ?",
    it: "Quale intendi?",
    tr: "Hangisini kastediyorsun?",
    ar: "أيهما تقصد؟",
    zh: "你指的是哪一个？",
  },
  whichRestaurant: {
    de: "Welches Restaurant meinst du?",
    en: "Which restaurant do you mean?",
    es: "¿Qué restaurante quieres decir?",
    fr: "Quel restaurant veux-tu dire ?",
    it: "Quale ristorante intendi?",
    tr: "Hangi restoranı kastediyorsun?",
    ar: "أي مطعم تقصد؟",
    zh: "你指的是哪家餐厅？",
  },
  whichDate: {
    de: "Welches Datum meinst du?",
    en: "Which date do you mean?",
    es: "¿Qué fecha quieres decir?",
    fr: "Quelle date veux-tu dire ?",
    it: "Quale data intendi?",
    tr: "Hangi tarihi kastediyorsun?",
    ar: "أي تاريخ تقصد؟",
    zh: "你指的是哪个日期？",
  },
  amount: {
    de: "Welchen Betrag meinst du?",
    en: "Which amount do you mean?",
    es: "¿Qué importe quieres decir?",
    fr: "Quel montant veux-tu dire ?",
    it: "Quale importo intendi?",
    tr: "Hangi tutarı kastediyorsun?",
    ar: "أي مبلغ تقصد؟",
    zh: "你指的是哪一笔金额？",
  },
  dish: {
    de: "Welches Gericht meinst du?",
    en: "Which dish do you mean?",
    es: "¿Qué plato quieres decir?",
    fr: "Quel plat veux-tu dire ?",
    it: "Quale piatto intendi?",
    tr: "Hangi yemeği kastediyorsun?",
    ar: "أي طبق تقصد؟",
    zh: "你指的是哪道菜？",
  },
  noWriteAll: {
    de: "Für welches Restaurant soll ich das anlegen?",
    en: "Which restaurant should I save this for?",
    es: "¿Para qué restaurante lo guardo?",
    fr: "Pour quel restaurant dois-je l’enregistrer ?",
    it: "Per quale ristorante lo salvo?",
    tr: "Bunu hangi restoran için kaydedeyim?",
    ar: "لأي مطعم أحفظ ذلك؟",
    zh: "要为哪家餐厅保存？",
  },
} as const;

export type AssistantAskKey = keyof typeof ASK;

export function assistantAsk(locale: AppLocale, key: AssistantAskKey): string {
  return ASK[key][locale] ?? ASK[key].de;
}

export function assistantAskWhich(
  locale: AppLocale,
  key: AssistantAskKey,
  labels: string[],
): string {
  const names = labels
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 5);
  const question = assistantAsk(locale, key);
  if (!names.length) return question;
  return `${question} ${names.join(", ")}`;
}

export function firstReservationQuestion(
  args: {
    date_ymd?: string;
    time_hm?: string;
    party_size?: number;
    guest_first_name?: string;
  },
  locale: AppLocale,
): { field: string; ask: string } | null {
  const dateYmd = args.date_ymd?.trim() ?? "";
  const timeHm = args.time_hm?.trim() ?? "";
  const partySize = Number(args.party_size);
  const firstName = args.guest_first_name?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    return { field: "date_ymd", ask: assistantAsk(locale, "date") };
  }
  if (!/^\d{1,2}:\d{2}$/.test(timeHm)) {
    return { field: "time_hm", ask: assistantAsk(locale, "time") };
  }
  if (!Number.isFinite(partySize) || partySize < 1) {
    return { field: "party_size", ask: assistantAsk(locale, "party") };
  }
  if (!firstName) {
    return { field: "guest_first_name", ask: assistantAsk(locale, "guest") };
  }
  return null;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function isYmd(value: string | undefined | null): value is string {
  return Boolean(value && YMD.test(value.trim()));
}

/** Reads default to today. A named invalid date is a question, not a guess. */
export function resolveReadYmdRange(input: {
  today: string;
  dateYmd?: string | null;
  startYmd?: string | null;
  endYmd?: string | null;
  locale: AppLocale;
}): { start: string; end: string } | { ask: string } {
  const date = input.dateYmd?.trim() ?? "";
  const start = input.startYmd?.trim() ?? "";
  const end = input.endYmd?.trim() ?? "";
  if (date && !isYmd(date)) return { ask: assistantAsk(input.locale, "whichDate") };
  if (start && !isYmd(start)) return { ask: assistantAsk(input.locale, "whichDate") };
  if (end && !isYmd(end)) return { ask: assistantAsk(input.locale, "whichDate") };
  if (date) return { start: date, end: date };
  if (start && end) return { start, end };
  if (start) return { start, end: start };
  if (end) return { start: end, end };
  return { start: input.today, end: input.today };
}
