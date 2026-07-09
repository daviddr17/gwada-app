import "server-only";

import {
  buildReservationLogChanges,
  buildReservationLogDetails,
  reservationSnapshotFromPayload,
} from "@/lib/reservations/reservation-log-build";
import { insertReservationLogEntry } from "@/lib/reservations/reservation-log-insert";
import { dispatchReservationEmail } from "@/lib/reservations/reservation-email-dispatch";
import { reservationStatusDispatchEvent } from "@/lib/reservations/reservation-status-dispatch-event";
import { dispatchReservationWhatsapp } from "@/lib/reservations/reservation-whatsapp-dispatch";
import { RESERVATION_STATUS_EMBED } from "@/lib/supabase/reservations-db";
import { formatDiningTableLabel } from "@/lib/supabase/dining-floor-db";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatReservationGuestLabel,
} from "@/lib/types/reservation-log";

export type DisplayCreateReservationInput = {
  guest_first_name: string;
  guest_last_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  status_id: string;
  dining_table_id: string | null;
  dwell_minutes: number;
  notify_email: boolean;
  notify_whatsapp: boolean;
  terms_accepted: boolean;
  notes?: string | null;
};

export async function createDisplayReservation(
  admin: SupabaseClient,
  restaurantId: string,
  input: DisplayCreateReservationInput,
): Promise<
  | { ok: true; id: string; reservation_number: number; guest_pin: string }
  | { ok: false; error: string }
> {
  const { data, error } = await admin
    .from("reservations")
    .insert({
      restaurant_id: restaurantId,
      guest_first_name: input.guest_first_name,
      guest_last_name: input.guest_last_name,
      guest_phone: input.guest_phone,
      guest_email: input.guest_email,
      party_size: input.party_size,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      status_id: input.status_id,
      dining_table_id: input.dining_table_id,
      dwell_minutes: input.dwell_minutes,
      notify_email: input.notify_email,
      notify_whatsapp: input.notify_whatsapp,
      terms_accepted: input.terms_accepted,
      notes: input.notes?.trim() || null,
    })
    .select("id, reservation_number, guest_pin, contact_id")
    .single();

  if (error || !data?.id) {
    return { ok: false, error: error?.message ?? "create_failed" };
  }

  const guestFirst = input.guest_first_name.trim();
  const guestLast = input.guest_last_name.trim();
  const { data: statusRow } = await admin
    .from("reservation_statuses")
    .select("name")
    .eq("id", input.status_id)
    .maybeSingle();
  let tableLabel = "Kein Tisch";
  if (input.dining_table_id) {
    const { data: tableRow } = await admin
      .from("dining_tables")
      .select("table_number, table_name")
      .eq("id", input.dining_table_id)
      .maybeSingle();
    if (tableRow) {
      tableLabel = formatDiningTableLabel({
        table_number: tableRow.table_number as number,
        table_name: (tableRow.table_name as string | null) ?? null,
      });
    }
  }
  const after = reservationSnapshotFromPayload(
    {
      ...input,
      notes: input.notes?.trim() || null,
    },
    (statusRow?.name as string | undefined) ?? "—",
    tableLabel,
  );
  await insertReservationLogEntry(admin, {
    restaurantId,
    reservationId: data.id as string,
    actorUserId: null,
    action: "created",
    reservationNumber: data.reservation_number as number,
    guestLabel: formatReservationGuestLabel(
      data.reservation_number as number,
      guestFirst,
      guestLast,
    ),
    details: buildReservationLogDetails(
      buildReservationLogChanges(null, after),
      { actorSource: "display", summary: "Über Display angelegt" },
    ),
  });

  if (input.notify_whatsapp) {
    void dispatchReservationWhatsapp(admin, data.id as string, "created").catch(
      () => undefined,
    );
  }
  if (input.notify_email) {
    void dispatchReservationEmail(admin, data.id as string, "created").catch(
      () => undefined,
    );
  }

  return {
    ok: true,
    id: data.id as string,
    reservation_number: data.reservation_number as number,
    guest_pin: data.guest_pin as string,
  };
}

export async function updateDisplayReservationStatus(
  admin: SupabaseClient,
  restaurantId: string,
  reservationId: string,
  statusId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: reservation } = await admin
    .from("reservations")
    .select(
      `
      id,
      restaurant_id,
      reservation_number,
      guest_first_name,
      guest_last_name,
      notify_email,
      notify_whatsapp,
      ${RESERVATION_STATUS_EMBED} ( code, name )
    `,
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation || reservation.restaurant_id !== restaurantId) {
    return { ok: false, error: "not_found" };
  }

  const statusRaw = (reservation as Record<string, unknown>).reservation_statuses;
  const statusOne = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
  const previousName =
    statusOne && typeof statusOne === "object" && "name" in statusOne
      ? String((statusOne as { name: string }).name)
      : "—";

  const { data: newStatus } = await admin
    .from("reservation_statuses")
    .select("code, name")
    .eq("id", statusId)
    .maybeSingle();

  const newCode = (newStatus?.code as string | undefined) ?? "";
  const newName = (newStatus?.name as string | undefined) ?? "—";
  const dispatchEvent = reservationStatusDispatchEvent(
    statusOne && typeof statusOne === "object" && "code" in statusOne
      ? String((statusOne as { code: string }).code)
      : null,
    newCode,
  );

  const { error } = await admin
    .from("reservations")
    .update({ status_id: statusId })
    .eq("id", reservationId);

  if (error) {
    return { ok: false, error: error.message };
  }

  if (previousName !== newName) {
    await insertReservationLogEntry(admin, {
      restaurantId,
      reservationId,
      actorUserId: null,
      action: "updated",
      reservationNumber: reservation.reservation_number as number,
      guestLabel: formatReservationGuestLabel(
        reservation.reservation_number as number,
        reservation.guest_first_name as string,
        reservation.guest_last_name as string,
      ),
      details: buildReservationLogDetails([], {
        actorSource: "display",
        summary: `Status: „${previousName}“ → „${newName}“`,
      }),
    });
  }

  if (dispatchEvent && reservation.notify_whatsapp) {
    void dispatchReservationWhatsapp(admin, reservationId, dispatchEvent).catch(
      () => undefined,
    );
  }
  if (dispatchEvent && reservation.notify_email) {
    void dispatchReservationEmail(admin, reservationId, dispatchEvent).catch(
      () => undefined,
    );
  }

  return { ok: true };
}

export type DisplayUpdateReservationInput = {
  guest_first_name: string;
  guest_last_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  status_id: string;
  dining_table_id: string | null;
  dwell_minutes: number | null;
  notify_email: boolean;
  notify_whatsapp: boolean;
  terms_accepted: boolean;
  notes: string | null;
};

export async function updateDisplayReservation(
  admin: SupabaseClient,
  restaurantId: string,
  reservationId: string,
  input: DisplayUpdateReservationInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: reservation } = await admin
    .from("reservations")
    .select(
      `
      id,
      restaurant_id,
      reservation_number,
      guest_first_name,
      guest_last_name,
      guest_phone,
      guest_email,
      party_size,
      starts_at,
      ends_at,
      dwell_minutes,
      dining_table_id,
      notify_email,
      notify_whatsapp,
      terms_accepted,
      notes,
      ${RESERVATION_STATUS_EMBED} ( code, name )
    `,
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation || reservation.restaurant_id !== restaurantId) {
    return { ok: false, error: "not_found" };
  }

  const statusRaw = (reservation as Record<string, unknown>).reservation_statuses;
  const statusOne = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
  const previousCode =
    statusOne && typeof statusOne === "object" && "code" in statusOne
      ? String((statusOne as { code: string }).code)
      : null;
  const previousStatusName =
    statusOne && typeof statusOne === "object" && "name" in statusOne
      ? String((statusOne as { name: string }).name)
      : "—";

  const { data: newStatus } = await admin
    .from("reservation_statuses")
    .select("code, name")
    .eq("id", input.status_id)
    .maybeSingle();

  const newCode = (newStatus?.code as string | undefined) ?? "";
  const newStatusName = (newStatus?.name as string | undefined) ?? "—";
  if (
    input.dining_table_id &&
    newCode !== "confirmed" &&
    newCode !== "seated"
  ) {
    return { ok: false, error: "table_requires_confirmed" };
  }

  const beforeTableId = (reservation.dining_table_id as string | null) ?? null;
  const beforeTableLabel = await resolveTableLabel(admin, beforeTableId);
  const afterTableLabel = await resolveTableLabel(admin, input.dining_table_id);

  const before = reservationSnapshotFromPayload(
    {
      guest_first_name: reservation.guest_first_name as string,
      guest_last_name: reservation.guest_last_name as string,
      guest_phone: (reservation.guest_phone as string | null) ?? null,
      guest_email: (reservation.guest_email as string | null) ?? null,
      party_size: reservation.party_size as number,
      starts_at: reservation.starts_at as string,
      ends_at: reservation.ends_at as string,
      status_id: input.status_id,
      dining_table_id: beforeTableId,
      dwell_minutes: (reservation.dwell_minutes as number | null) ?? null,
      notify_email: Boolean(reservation.notify_email),
      notify_whatsapp: Boolean(reservation.notify_whatsapp),
      terms_accepted: Boolean(reservation.terms_accepted),
      notes: (reservation.notes as string | null) ?? null,
    },
    previousStatusName,
    beforeTableLabel,
  );
  const after = reservationSnapshotFromPayload(
    input,
    newStatusName,
    afterTableLabel,
  );

  const dispatchEvent = reservationStatusDispatchEvent(previousCode, newCode);

  const { error } = await admin
    .from("reservations")
    .update({
      guest_first_name: input.guest_first_name,
      guest_last_name: input.guest_last_name,
      guest_phone: input.guest_phone,
      guest_email: input.guest_email,
      party_size: input.party_size,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      status_id: input.status_id,
      dining_table_id: input.dining_table_id,
      dwell_minutes: input.dwell_minutes,
      notify_email: input.notify_email,
      notify_whatsapp: input.notify_whatsapp,
      terms_accepted: input.terms_accepted,
      notes: input.notes?.trim() || null,
    })
    .eq("id", reservationId);

  if (error) {
    return { ok: false, error: error.message };
  }

  const changes = buildReservationLogChanges(before, after);
  if (changes.length > 0) {
    await insertReservationLogEntry(admin, {
      restaurantId,
      reservationId,
      actorUserId: null,
      action: "updated",
      reservationNumber: reservation.reservation_number as number,
      guestLabel: formatReservationGuestLabel(
        reservation.reservation_number as number,
        input.guest_first_name,
        input.guest_last_name,
      ),
      details: buildReservationLogDetails(changes, { actorSource: "display" }),
    });
  }

  const notifyWhatsapp = input.notify_whatsapp;
  const notifyEmail = input.notify_email;

  if (dispatchEvent && notifyWhatsapp) {
    void dispatchReservationWhatsapp(admin, reservationId, dispatchEvent).catch(
      () => undefined,
    );
  }
  if (dispatchEvent && notifyEmail) {
    void dispatchReservationEmail(admin, reservationId, dispatchEvent).catch(
      () => undefined,
    );
  }

  return { ok: true };
}

export async function updateDisplayReservationTable(
  admin: SupabaseClient,
  restaurantId: string,
  reservationId: string,
  diningTableId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: reservation } = await admin
    .from("reservations")
    .select(
      "id, restaurant_id, reservation_number, guest_first_name, guest_last_name, dining_table_id, status_id",
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation || reservation.restaurant_id !== restaurantId) {
    return { ok: false, error: "not_found" };
  }

  const beforeTableLabel = await resolveTableLabel(
    admin,
    (reservation.dining_table_id as string | null) ?? null,
  );
  const afterTableLabel = await resolveTableLabel(admin, diningTableId);

  const { data: statusRow } = await admin
    .from("reservation_statuses")
    .select("code")
    .eq("id", reservation.status_id as string)
    .maybeSingle();

  if (
    diningTableId &&
    statusRow?.code !== "confirmed" &&
    statusRow?.code !== "seated"
  ) {
    return { ok: false, error: "table_requires_confirmed" };
  }

  const { error } = await admin
    .from("reservations")
    .update({ dining_table_id: diningTableId })
    .eq("id", reservationId);

  if (error) {
    return { ok: false, error: error.message };
  }

  if (beforeTableLabel !== afterTableLabel) {
    await insertReservationLogEntry(admin, {
      restaurantId,
      reservationId,
      actorUserId: null,
      action: "updated",
      reservationNumber: reservation.reservation_number as number,
      guestLabel: formatReservationGuestLabel(
        reservation.reservation_number as number,
        reservation.guest_first_name as string,
        reservation.guest_last_name as string,
      ),
      details: buildReservationLogDetails([], {
        actorSource: "display",
        summary: `Tisch: „${beforeTableLabel}“ → „${afterTableLabel}“`,
      }),
    });
  }

  return { ok: true };
}

async function resolveTableLabel(
  admin: SupabaseClient,
  tableId: string | null,
): Promise<string> {
  if (!tableId) return "Kein Tisch";
  const { data: tableRow } = await admin
    .from("dining_tables")
    .select("table_number, table_name")
    .eq("id", tableId)
    .maybeSingle();
  if (!tableRow) return "—";
  return formatDiningTableLabel({
    table_number: tableRow.table_number as number,
    table_name: (tableRow.table_name as string | null) ?? null,
  });
}

export async function deleteDisplayReservation(
  admin: SupabaseClient,
  restaurantId: string,
  reservationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: reservation } = await admin
    .from("reservations")
    .select(
      "id, restaurant_id, reservation_number, guest_first_name, guest_last_name",
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation || reservation.restaurant_id !== restaurantId) {
    return { ok: false, error: "not_found" };
  }

  const { error } = await admin.from("reservations").delete().eq("id", reservationId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await insertReservationLogEntry(admin, {
    restaurantId,
    reservationId,
    actorUserId: null,
    action: "deleted",
    reservationNumber: reservation.reservation_number as number,
    guestLabel: formatReservationGuestLabel(
      reservation.reservation_number as number,
      reservation.guest_first_name as string,
      reservation.guest_last_name as string,
    ),
    details: buildReservationLogDetails([], {
      actorSource: "display",
      summary: "Reservierung gelöscht",
    }),
  });

  return { ok: true };
}

export async function applyDisplayAutoTableAssignments(
  admin: SupabaseClient,
  restaurantId: string,
  assignments: Map<string, string | null>,
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  let updated = 0;
  for (const [reservationId, tableId] of assignments) {
    const result = await updateDisplayReservationTable(
      admin,
      restaurantId,
      reservationId,
      tableId,
    );
    if (!result.ok) {
      return result;
    }
    updated += 1;
  }
  return { ok: true, updated };
}
