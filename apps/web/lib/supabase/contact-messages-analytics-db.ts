import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  ContactMessageDirection,
  ContactMessagePlatform,
} from "@/lib/constants/contact-message-platforms";
import type { ContactStatsPeriod } from "@/lib/contacts/compute-contact-statistics";
import {
  exclusiveUtcIsoAfterLocalVisibleEnd,
  startOfLocalDay,
} from "@/lib/reservations/month-range";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type ContactMessageAnalyticsRow = {
  id: string;
  contact_id: string;
  platform: ContactMessagePlatform;
  direction: ContactMessageDirection;
  created_at: string;
  reservation_id: string | null;
};

export type ContactAnalyticsRow = {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  created_at: string;
  last_interaction_at: string | null;
  reservation_count: number;
  message_count: number;
  has_email: boolean;
  has_phone: boolean;
  has_messaging: boolean;
};

export type ContactStatisticsBundle = {
  messages: ContactMessageAnalyticsRow[];
  contacts: ContactAnalyticsRow[];
  periodStart: Date;
  periodEnd: Date;
};

const MESSAGE_ANALYTICS_SELECT = `
  id,
  contact_id,
  platform,
  direction,
  created_at,
  reservation_id
`;

const CONTACT_ANALYTICS_SELECT = `
  id,
  first_name,
  last_name,
  company,
  created_at,
  last_interaction_at,
  contact_emails ( id ),
  contact_phones ( id ),
  contact_messaging_ids ( id )
`;

function buildReservationCountByContact(
  rows: Array<{ contact_id: string | null }>,
): Map<string, number> {
  const countByContact = new Map<string, number>();
  for (const row of rows) {
    const contactId = row.contact_id;
    if (!contactId) continue;
    countByContact.set(contactId, (countByContact.get(contactId) ?? 0) + 1);
  }
  return countByContact;
}

function mapContactAnalyticsRow(
  raw: Record<string, unknown>,
  reservationCount: number,
): ContactAnalyticsRow {
  const emails = raw.contact_emails as unknown[] | null;
  const phones = raw.contact_phones as unknown[] | null;
  const messaging = raw.contact_messaging_ids as unknown[] | null;
  return {
    id: raw.id as string,
    first_name: raw.first_name as string,
    last_name: raw.last_name as string,
    company: (raw.company as string | null) ?? null,
    created_at: raw.created_at as string,
    last_interaction_at: (raw.last_interaction_at as string | null) ?? null,
    reservation_count: reservationCount,
    message_count: 0,
    has_email: (emails?.length ?? 0) > 0,
    has_phone: (phones?.length ?? 0) > 0,
    has_messaging: (messaging?.length ?? 0) > 0,
  };
}

function periodRange(monthsBack: ContactStatsPeriod): {
  periodStart: Date;
  periodEnd: Date;
  rangeStartIso: string;
} {
  const periodEnd = startOfLocalDay(new Date());
  const periodStart = startOfLocalDay(new Date());
  periodStart.setMonth(periodStart.getMonth() - monthsBack);
  return {
    periodStart,
    periodEnd,
    rangeStartIso: periodStart.toISOString(),
  };
}

export async function fetchContactStatisticsBundle(params: {
  restaurantId: string;
  monthsBack?: ContactStatsPeriod;
}): Promise<{ data: ContactStatisticsBundle | null; error: string | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: null, error: null };
  }

  const months = params.monthsBack ?? 12;
  const { periodStart, periodEnd, rangeStartIso } = periodRange(months);
  const rangeEndIso = exclusiveUtcIsoAfterLocalVisibleEnd(periodEnd);

  const sb = createSupabaseBrowserClient();
  const [messagesRes, contactsRes, reservationsRes] = await Promise.all([
    sb
      .from("contact_messages")
      .select(MESSAGE_ANALYTICS_SELECT)
      .eq("restaurant_id", params.restaurantId)
      .gte("created_at", rangeStartIso)
      .lt("created_at", rangeEndIso)
      .order("created_at", { ascending: true }),
    sb
      .from("contacts")
      .select(CONTACT_ANALYTICS_SELECT)
      .eq("restaurant_id", params.restaurantId)
      .order("created_at", { ascending: false }),
    sb
      .from("reservations")
      .select("contact_id")
      .eq("restaurant_id", params.restaurantId)
      .not("contact_id", "is", null),
  ]);

  const error =
    messagesRes.error?.message ??
    contactsRes.error?.message ??
    reservationsRes.error?.message ??
    null;
  if (error) {
    return { data: null, error };
  }

  const reservationCountByContact = buildReservationCountByContact(
    (reservationsRes.data ?? []) as Array<{ contact_id: string | null }>,
  );

  const messages = (messagesRes.data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: row.id as string,
      contact_id: row.contact_id as string,
      platform: row.platform as ContactMessagePlatform,
      direction: row.direction as ContactMessageDirection,
      created_at: row.created_at as string,
      reservation_id: (row.reservation_id as string | null) ?? null,
    };
  });

  const contacts = (contactsRes.data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return mapContactAnalyticsRow(
      row,
      reservationCountByContact.get(row.id as string) ?? 0,
    );
  });

  return {
    data: {
      messages,
      contacts,
      periodStart,
      periodEnd,
    },
    error: null,
  };
}
