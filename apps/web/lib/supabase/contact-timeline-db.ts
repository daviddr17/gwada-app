import {
  mergeMessageRowsById,
} from "@/lib/contact-messages/reservation-message-thread-keys";
import { isLinkedContactId } from "@/lib/contact-messages/is-linked-contact-id";
import { wahaPseudoContactIdFromChatId } from "@/lib/contact-messages/whatsapp-pseudo-contact";
import { normalizeContactEmail } from "@/lib/contacts/normalize-contact-identity";
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
import type { ContactNoteRow } from "@/lib/supabase/contact-notes-db";
import { fetchContactNotes } from "@/lib/supabase/contact-notes-db";
import type {
  ContactDetail,
  ContactEmailRow,
  ContactPhoneRow,
  ContactReservationLink,
} from "@/lib/supabase/contacts-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";

export type ContactTimelineKind =
  | "reservation"
  | "message"
  | "note"
  | "legacy_note";

export type ContactTimelineEntry = {
  id: string;
  kind: ContactTimelineKind;
  at: string;
  title: string;
  subtitle?: string;
  body?: string;
  reservationId?: string;
  messagePlatform?: ContactMessagePlatform;
  messageDirection?: "inbound" | "outbound";
};

const MESSAGE_SELECT = `
  id,
  platform,
  direction,
  body,
  reservation_id,
  created_at
`;

function contactThreadKeysFromDetail(contact: {
  id: string;
  contact_emails: ContactEmailRow[];
  contact_phones: ContactPhoneRow[];
}): string[] {
  const keys = new Set<string>();
  if (isLinkedContactId(contact.id)) {
    keys.add(contact.id);
  }

  for (const e of contact.contact_emails) {
    const norm = normalizeContactEmail(e.email);
    if (norm) keys.add(`email:${norm}`);
  }

  for (const p of contact.contact_phones) {
    const chatId = guestPhoneToWhatsAppChatId(p.phone_display);
    if (chatId) keys.add(wahaPseudoContactIdFromChatId(chatId));
  }

  return [...keys];
}

async function fetchRawMessagesForThreadKey(
  restaurantId: string,
  threadKey: string,
): Promise<{ rows: Record<string, unknown>[]; error: Error | null }> {
  const sb = createSupabaseBrowserClient();
  let q = sb
    .from("contact_messages")
    .select(MESSAGE_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: true });

  if (isLinkedContactId(threadKey)) {
    q = q.eq("contact_id", threadKey);
  } else {
    q = q.eq("conversation_key", threadKey);
  }

  const { data, error } = await q;
  if (error) return { rows: [], error: new Error(error.message) };
  return { rows: (data ?? []) as Record<string, unknown>[], error: null };
}

async function fetchContactThreadMessages(params: {
  restaurantId: string;
  contact: ContactDetail;
}): Promise<{ data: Record<string, unknown>[]; error: Error | null }> {
  const threadKeys = contactThreadKeysFromDetail(params.contact);
  const rawById = new Map<string, Record<string, unknown>>();

  for (const threadKey of threadKeys) {
    const { rows, error } = await fetchRawMessagesForThreadKey(
      params.restaurantId,
      threadKey,
    );
    if (error) return { data: [], error };
    mergeMessageRowsById(rawById, rows);
  }

  // Reservierungs-Threads sind über contactThreadKeysFromDetail abgedeckt.

  const sorted = [...rawById.values()].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at)),
  );
  return { data: sorted, error: null };
}

function reservationTimelineTitle(r: ContactReservationLink): string {
  return `Reservierung #${r.reservation_number}`;
}

function messageTimelineTitle(
  platform: string,
  direction: string,
): string {
  const dir = direction === "outbound" ? "Ausgehend" : "Eingehend";
  const plat =
    platform === "whatsapp"
      ? "WhatsApp"
      : platform === "email"
        ? "E-Mail"
        : platform === "gwada"
          ? "Gwada"
          : platform;
  return `${dir} · ${plat}`;
}

function platformLabel(platform: string): ContactMessagePlatform {
  if (
    platform === "whatsapp" ||
    platform === "email" ||
    platform === "gwada" ||
    platform === "facebook" ||
    platform === "instagram"
  ) {
    return platform;
  }
  return "gwada";
}

export async function buildContactTimeline(params: {
  restaurantId: string;
  contact: ContactDetail;
  notes: ContactNoteRow[];
}): Promise<{ data: ContactTimelineEntry[]; error: Error | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: [], error: null };
  }

  const entries: ContactTimelineEntry[] = [];

  for (const r of params.contact.reservations) {
    entries.push({
      id: `reservation:${r.id}`,
      kind: "reservation",
      at: r.starts_at,
      title: reservationTimelineTitle(r),
      subtitle: `${r.party_size} Pers.`,
      reservationId: r.id,
    });
  }

  const { data: messageRows, error: msgErr } = await fetchContactThreadMessages({
    restaurantId: params.restaurantId,
    contact: params.contact,
  });
  if (msgErr) return { data: [], error: msgErr };

  for (const m of messageRows) {
    const platform = String(m.platform ?? "gwada");
    const direction = String(m.direction ?? "inbound");
    const body = String(m.body ?? "").trim();
    entries.push({
      id: `message:${m.id as string}`,
      kind: "message",
      at: String(m.created_at),
      title: messageTimelineTitle(platform, direction),
      body: body.length > 120 ? `${body.slice(0, 117)}…` : body || undefined,
      reservationId: (m.reservation_id as string | null) ?? undefined,
      messagePlatform: platformLabel(platform),
      messageDirection: direction === "outbound" ? "outbound" : "inbound",
    });
  }

  for (const n of params.notes) {
    entries.push({
      id: `note:${n.id}`,
      kind: "note",
      at: n.created_at,
      title: "Notiz",
      body: n.body,
    });
  }

  const legacyNotes = params.contact.notes?.trim();
  if (legacyNotes && params.notes.length === 0) {
    entries.push({
      id: `legacy-note:${params.contact.id}`,
      kind: "legacy_note",
      at: params.contact.updated_at,
      title: "Notiz (Stammdaten)",
      body: legacyNotes,
    });
  }

  entries.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  return { data: entries, error: null };
}

export async function fetchContactTimeline(params: {
  restaurantId: string;
  contact: ContactDetail;
}): Promise<{ data: ContactTimelineEntry[]; error: Error | null }> {
  const { data: notes, error: notesErr } = await fetchContactNotes({
    restaurantId: params.restaurantId,
    contactId: params.contact.id,
  });
  if (notesErr) return { data: [], error: notesErr };
  return buildContactTimeline({
    restaurantId: params.restaurantId,
    contact: params.contact,
    notes,
  });
}
