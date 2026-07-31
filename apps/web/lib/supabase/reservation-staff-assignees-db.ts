import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type ReservationStaffAssigneeJoin = {
  staff_id: string;
  given_name: string | null;
  family_name: string | null;
};

export function mapReservationStaffAssigneesRaw(
  raw: unknown,
): ReservationStaffAssigneeJoin[] {
  if (!Array.isArray(raw)) return [];
  const out: ReservationStaffAssigneeJoin[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const staffId =
      typeof row.staff_id === "string" ? row.staff_id : null;
    if (!staffId) continue;
    const staffRaw = row.restaurant_staff;
    const staff = Array.isArray(staffRaw) ? staffRaw[0] : staffRaw;
    const s =
      staff && typeof staff === "object"
        ? (staff as Record<string, unknown>)
        : null;
    out.push({
      staff_id: staffId,
      given_name:
        s && typeof s.given_name === "string" ? s.given_name : null,
      family_name:
        s && typeof s.family_name === "string" ? s.family_name : null,
    });
  }
  return out;
}

export function reservationAssigneeStaffIds(
  assignees: ReservationStaffAssigneeJoin[] | null | undefined,
): string[] {
  return (assignees ?? []).map((a) => a.staff_id);
}

export function formatReservationAssigneeNames(
  assignees: ReservationStaffAssigneeJoin[] | null | undefined,
): string {
  const names = (assignees ?? [])
    .map((a) => {
      const family = a.family_name?.trim() ?? "";
      const given = a.given_name?.trim() ?? "";
      if (family && given) return `${family}, ${given}`;
      return family || given;
    })
    .filter(Boolean);
  return names.join(" · ");
}

/** Ersetzt die Mitarbeiter-Zuweisung einer Reservierung (diff delete + insert). */
export async function replaceReservationStaffAssignees(params: {
  reservationId: string;
  restaurantId: string;
  staffIds: string[];
}): Promise<{ error: Error | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { error: new Error("Ungültige Restaurant-ID.") };
  }
  const uniqueIds = [...new Set(params.staffIds.filter(Boolean))];
  const sb = createSupabaseBrowserClient();

  if (uniqueIds.length > 0) {
    const { data: staffRows, error: staffErr } = await sb
      .from("restaurant_staff")
      .select("id")
      .eq("restaurant_id", params.restaurantId)
      .in("id", uniqueIds);
    if (staffErr) {
      return { error: new Error(staffErr.message) };
    }
    const allowed = new Set((staffRows ?? []).map((r) => r.id as string));
    for (const id of uniqueIds) {
      if (!allowed.has(id)) {
        return {
          error: new Error("Mitarbeiter gehört nicht zu diesem Restaurant."),
        };
      }
    }
  }

  const { error: delErr } = await sb
    .from("reservation_staff_assignees")
    .delete()
    .eq("reservation_id", params.reservationId);
  if (delErr) {
    return { error: new Error(delErr.message) };
  }

  if (uniqueIds.length === 0) {
    return { error: null };
  }

  const { error: insErr } = await sb.from("reservation_staff_assignees").insert(
    uniqueIds.map((staff_id) => ({
      reservation_id: params.reservationId,
      staff_id,
    })),
  );
  if (insErr) {
    return { error: new Error(insErr.message) };
  }
  return { error: null };
}
