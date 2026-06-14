import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapRawToReservationListRow,
  RESERVATION_LIST_ROW_SELECT,
} from "@/lib/supabase/reservations-db";
import type { NotificationModuleId } from "@/lib/notifications/notification-modules";

const RESERVATION_CANCELLATION_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

const STATUS_BY_MODULE: Record<
  Extract<
    NotificationModuleId,
    | "reservations_pending"
    | "reservations_change_request"
    | "reservations_cancellation"
  >,
  string
> = {
  reservations_pending: "pending",
  reservations_change_request: "change_requested",
  reservations_cancellation: "cancelled",
};

async function fetchDismissedReservationIds(
  sb: SupabaseClient,
  params: {
    profileId: string;
    restaurantId: string;
    module: NotificationModuleId;
  },
): Promise<Set<string>> {
  const { data } = await sb
    .from("restaurant_reservation_notification_dismissals")
    .select("reservation_id")
    .eq("profile_id", params.profileId)
    .eq("restaurant_id", params.restaurantId)
    .eq("module", params.module);

  return new Set(
    (data ?? []).map((row) => (row as { reservation_id: string }).reservation_id),
  );
}

async function fetchStatusIdByCode(
  sb: SupabaseClient,
  code: string,
): Promise<string | null> {
  const { data } = await sb
    .from("reservation_statuses")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function loadReservationNotificationItems(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    module:
      | "reservations_pending"
      | "reservations_change_request"
      | "reservations_cancellation";
    limit?: number;
  },
) {
  const statusCode = STATUS_BY_MODULE[params.module];
  const statusId = await fetchStatusIdByCode(sb, statusCode);
  if (!statusId) return { items: [], totalCount: 0 };

  const dismissed = await fetchDismissedReservationIds(sb, {
    profileId: params.userId,
    restaurantId: params.restaurantId,
    module: params.module,
  });

  let query = sb
    .from("reservations")
    .select(RESERVATION_LIST_ROW_SELECT)
    .eq("restaurant_id", params.restaurantId)
    .eq("status_id", statusId);

  if (params.module === "reservations_cancellation") {
    const since = new Date(
      Date.now() - RESERVATION_CANCELLATION_LOOKBACK_MS,
    ).toISOString();
    query = query.gte("updated_at", since);
  } else {
    query = query.gte("starts_at", new Date().toISOString());
  }

  const limit = params.limit ?? 5;
  const queryLimit = Math.min(Math.max(limit, 5), 500);

  const { data, error } = await query
    .order(
      params.module === "reservations_cancellation" ? "updated_at" : "starts_at",
      { ascending: params.module !== "reservations_cancellation" },
    )
    .limit(queryLimit);

  if (error) {
    console.warn("[gwada] reservation notification items", error.message);
    return { items: [], totalCount: 0 };
  }

  const filtered = (data ?? [])
    .map((row) => mapRawToReservationListRow(row as Record<string, unknown>))
    .filter((r) => !dismissed.has(r.id));

  const items = filtered.slice(0, limit).map((r) => {
      const guestLabel =
        `${r.guest_first_name} ${r.guest_last_name}`.trim() || "Gast";
      const subtitleParts = [
        `${r.party_size} Gäste`,
        r.reservation_statuses?.name ?? "—",
      ];
      if (params.module === "reservations_change_request") {
        subtitleParts.push("Änderung prüfen");
      }
      return {
        id: r.id,
        title: guestLabel,
        subtitle: subtitleParts.join(" · "),
        href: `/dashboard/reservierungen/uebersicht?reservation=${r.id}`,
        at:
          params.module === "reservations_cancellation"
            ? (r.updated_at ?? r.starts_at)
            : r.starts_at,
        meta: {
          reservationId: r.id,
          ...(r.contact_id ? { contactId: r.contact_id } : {}),
        },
      };
    });

  return { items, totalCount: filtered.length };
}

export async function dismissReservationNotification(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    reservationId: string;
    module:
      | "reservations_pending"
      | "reservations_change_request"
      | "reservations_cancellation";
  },
): Promise<{ error: string | null }> {
  const { error } = await sb
    .from("restaurant_reservation_notification_dismissals")
    .upsert(
      {
        profile_id: params.userId,
        restaurant_id: params.restaurantId,
        reservation_id: params.reservationId,
        module: params.module,
      },
      { onConflict: "profile_id,reservation_id,module" },
    );

  return { error: error?.message ?? null };
}

export async function dismissAllReservationNotifications(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    module:
      | "reservations_pending"
      | "reservations_change_request"
      | "reservations_cancellation";
  },
): Promise<{ error: string | null }> {
  const { items } = await loadReservationNotificationItems(sb, {
    restaurantId: params.restaurantId,
    userId: params.userId,
    module: params.module,
    limit: 500,
  });

  if (items.length === 0) return { error: null };

  const rows = items.map((item) => ({
    profile_id: params.userId,
    restaurant_id: params.restaurantId,
    reservation_id: item.id,
    module: params.module,
  }));

  const { error } = await sb
    .from("restaurant_reservation_notification_dismissals")
    .upsert(rows, { onConflict: "profile_id,reservation_id,module" });

  return { error: error?.message ?? null };
}
