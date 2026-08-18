import { reservationGuestDisplayName } from "@/lib/reservations/reservation-guest-name";
import { isPrivateEventReservation } from "@/lib/reservations/reservation-kind";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";
import type { UnifiedEventItem } from "@/lib/events/unified-event-item";

function reservationStatusToEventStatus(
  code: string | null | undefined,
): UnifiedEventItem["status"] {
  switch (code) {
    case "cancelled":
      return "cancelled";
    case "confirmed":
    case "seated":
    case "completed":
      return "published";
    case "pending":
    case "change_requested":
      return "draft";
    default:
      return "scheduled";
  }
}

export function privateEventFeedItemId(reservationId: string): string {
  return `private:${reservationId}`;
}

export function reservationIdFromPrivateEventFeedItemId(
  itemId: string,
): string | null {
  return itemId.startsWith("private:") ? itemId.slice("private:".length) : null;
}

export function mapPrivateEventReservationToFeedItem(
  row: ReservationListRow,
): UnifiedEventItem | null {
  if (!isPrivateEventReservation(row)) return null;
  const title = reservationGuestDisplayName(
    row.guest_first_name,
    row.guest_last_name,
    row.guest_company,
  );
  const partyLine = `${row.party_size} Personen`;
  const notes = row.notes?.trim() ?? "";
  const description = notes ? `${partyLine}\n${notes}` : partyLine;
  const statusCode = row.reservation_statuses?.code ?? null;

  return {
    id: privateEventFeedItemId(row.id),
    platform: "gwada",
    source: "private",
    eventId: row.id,
    title,
    description,
    coverUrl: null,
    coverStoragePath: null,
    startAt: row.starts_at,
    endAt: row.ends_at,
    ticketUrl: null,
    location: row.guest_company,
    status: reservationStatusToEventStatus(statusCode),
    canEdit: true,
    canDelete: true,
    externalUrl: null,
    createdAt: row.created_at,
    publishedAt: null,
    isPinned: false,
    reservationId: row.id,
    partySize: row.party_size,
    guestCompany: row.guest_company,
    statusLabel: row.reservation_statuses?.name ?? null,
  };
}
