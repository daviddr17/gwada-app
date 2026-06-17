import {
  CONTACT_MESSAGE_PLATFORM_LABELS,
  type ContactMessageDirection,
  type ContactMessagePlatform,
} from "@/lib/constants/contact-message-platforms";
import { contactDisplayName } from "@/lib/supabase/contacts-db";
import type {
  ContactAnalyticsRow,
  ContactMessageAnalyticsRow,
} from "@/lib/supabase/contact-messages-analytics-db";

const WEEKDAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] as const;
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export type ContactStatsPeriod = 3 | 6 | 12;

const PLATFORM_COLORS: Record<ContactMessagePlatform, string> = {
  gwada: "var(--accent)",
  whatsapp: "var(--chart-1)",
  email: "var(--chart-2)",
  facebook: "var(--chart-3)",
  instagram: "var(--chart-4)",
};

const DIRECTION_LABELS: Record<ContactMessageDirection, string> = {
  inbound: "Eingehend",
  outbound: "Ausgehend",
};

const DIRECTION_COLORS: Record<ContactMessageDirection, string> = {
  inbound: "var(--chart-1)",
  outbound: "var(--chart-2)",
};

export type ContactStatisticsInput = {
  messages: ContactMessageAnalyticsRow[];
  contacts: ContactAnalyticsRow[];
  periodStart: Date;
  periodEnd: Date;
  totalUnread?: number;
};

export type ContactStatisticsResult = {
  totalMessages: number;
  inboundCount: number;
  outboundCount: number;
  inboundSharePercent: number | null;
  activeContacts: number;
  totalContacts: number;
  newContactsInPeriod: number;
  contactsWithReservations: number;
  reservationLinkedMessages: number;
  avgMessagesPerActiveContact: number | null;
  topPlatform: string | null;
  topWeekday: string | null;
  totalUnread: number;
  contactsWithEmail: number;
  contactsWithPhone: number;
  contactsWithMessaging: number;
  byPlatform: Array<{
    platform: ContactMessagePlatform;
    label: string;
    count: number;
    color: string;
  }>;
  byDirection: Array<{
    direction: ContactMessageDirection;
    label: string;
    count: number;
    color: string;
  }>;
  byHour: Array<{ hour: string; hourNum: number; count: number }>;
  byWeekday: Array<{ day: string; dayIndex: number; count: number }>;
  byMonth: Array<{ month: string; count: number }>;
  topContacts: Array<{ name: string; count: number }>;
};

function formatHourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
}

function contactInPeriod(
  createdAt: string,
  periodStart: Date,
  periodEnd: Date,
): boolean {
  const t = new Date(createdAt).getTime();
  return t >= periodStart.getTime() && t <= periodEnd.getTime();
}

export function computeContactStatistics(
  input: ContactStatisticsInput,
): ContactStatisticsResult {
  const messages = input.messages;
  const inboundCount = messages.filter((m) => m.direction === "inbound").length;
  const outboundCount = messages.filter(
    (m) => m.direction === "outbound",
  ).length;
  const inboundSharePercent =
    messages.length > 0
      ? Math.round((inboundCount / messages.length) * 100)
      : null;

  const activeContactIds = new Set(messages.map((m) => m.contact_id));
  const reservationLinkedMessages = messages.filter(
    (m) => m.reservation_id != null,
  ).length;

  const avgMessagesPerActiveContact =
    activeContactIds.size > 0
      ? Math.round((messages.length / activeContactIds.size) * 10) / 10
      : null;

  const platformCounts = new Map<ContactMessagePlatform, number>();
  for (const m of messages) {
    platformCounts.set(m.platform, (platformCounts.get(m.platform) ?? 0) + 1);
  }
  const byPlatform = (
    Object.keys(CONTACT_MESSAGE_PLATFORM_LABELS) as ContactMessagePlatform[]
  )
    .map((platform) => ({
      platform,
      label: CONTACT_MESSAGE_PLATFORM_LABELS[platform],
      count: platformCounts.get(platform) ?? 0,
      color: PLATFORM_COLORS[platform],
    }))
    .filter((row) => row.count > 0);
  const topPlatformEntry = [...byPlatform].sort((a, b) => b.count - a.count)[0];
  const topPlatform =
    topPlatformEntry && topPlatformEntry.count > 0
      ? topPlatformEntry.label
      : null;

  const directionCounts = new Map<ContactMessageDirection, number>();
  for (const m of messages) {
    directionCounts.set(
      m.direction,
      (directionCounts.get(m.direction) ?? 0) + 1,
    );
  }
  const byDirection = (
    Object.keys(DIRECTION_LABELS) as ContactMessageDirection[]
  ).map((direction) => ({
    direction,
    label: DIRECTION_LABELS[direction],
    count: directionCounts.get(direction) ?? 0,
    color: DIRECTION_COLORS[direction],
  }));

  const hourCounts = new Map<number, number>();
  for (const m of messages.filter((row) => row.direction === "inbound")) {
    const h = new Date(m.created_at).getHours();
    hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
  }
  const byHour = Array.from({ length: 24 }, (_, hourNum) => ({
    hourNum,
    hour: formatHourLabel(hourNum),
    count: hourCounts.get(hourNum) ?? 0,
  }));

  const weekdayCounts = new Map<number, number>();
  for (const m of messages) {
    const d = new Date(m.created_at).getDay();
    weekdayCounts.set(d, (weekdayCounts.get(d) ?? 0) + 1);
  }
  const byWeekday = WEEKDAY_ORDER.map((dayIndex) => ({
    dayIndex,
    day: WEEKDAY_SHORT[dayIndex],
    count: weekdayCounts.get(dayIndex) ?? 0,
  }));
  const topWeekdayEntry = [...byWeekday].sort((a, b) => b.count - a.count)[0];
  const topWeekday =
    topWeekdayEntry && topWeekdayEntry.count > 0 ? topWeekdayEntry.day : null;

  const monthCounts = new Map<string, number>();
  for (const m of messages) {
    const d = new Date(m.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const byMonth = [...monthCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({
      month: formatMonthLabel(month),
      count,
    }));

  const contactNameById = new Map(
    input.contacts.map((c) => [
      c.id,
      contactDisplayName({
        first_name: c.first_name,
        last_name: c.last_name,
        company: c.company,
      }),
    ]),
  );
  const messageCountByContact = new Map<string, number>();
  for (const m of messages) {
    messageCountByContact.set(
      m.contact_id,
      (messageCountByContact.get(m.contact_id) ?? 0) + 1,
    );
  }
  const topContacts = [...messageCountByContact.entries()]
    .map(([contactId, count]) => ({
      name: contactNameById.get(contactId) ?? "Kontakt",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const newContactsInPeriod = input.contacts.filter((c) =>
    contactInPeriod(c.created_at, input.periodStart, input.periodEnd),
  ).length;
  const contactsWithReservations = input.contacts.filter(
    (c) => c.reservation_count > 0,
  ).length;
  const contactsWithEmail = input.contacts.filter((c) => c.has_email).length;
  const contactsWithPhone = input.contacts.filter((c) => c.has_phone).length;
  const contactsWithMessaging = input.contacts.filter(
    (c) => c.has_messaging,
  ).length;

  return {
    totalMessages: messages.length,
    inboundCount,
    outboundCount,
    inboundSharePercent,
    activeContacts: activeContactIds.size,
    totalContacts: input.contacts.length,
    newContactsInPeriod,
    contactsWithReservations,
    reservationLinkedMessages,
    avgMessagesPerActiveContact,
    topPlatform,
    topWeekday,
    totalUnread: input.totalUnread ?? 0,
    contactsWithEmail,
    contactsWithPhone,
    contactsWithMessaging,
    byPlatform,
    byDirection,
    byHour,
    byWeekday,
    byMonth,
    topContacts,
  };
}
