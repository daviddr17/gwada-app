import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type {
  CreateStaffAvailabilitySlotInput,
  RestaurantStaffAvailabilitySlotRow,
  StaffAvailabilityWeekday,
} from "@/lib/types/staff-availability";

const SLOT_SELECT =
  "id, restaurant_id, staff_id, weekday, service_date, start_time, end_time, note, created_by, created_at, updated_at";

function mapSlotRow(raw: Record<string, unknown>): RestaurantStaffAvailabilitySlotRow {
  return {
    id: raw.id as string,
    restaurant_id: raw.restaurant_id as string,
    staff_id: raw.staff_id as string,
    weekday: (raw.weekday as StaffAvailabilityWeekday | null) ?? null,
    service_date: (raw.service_date as string | null) ?? null,
    start_time: String(raw.start_time ?? "").slice(0, 8),
    end_time: String(raw.end_time ?? "").slice(0, 8),
    note: (raw.note as string | null) ?? null,
    created_by: (raw.created_by as string | null) ?? null,
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
  };
}

function normalizeHmInput(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) return null;
  return `${trimmed}:00`;
}

export async function fetchStaffAvailabilitySlotsForStaff(
  restaurantId: string,
  staffId: string,
): Promise<{ data: RestaurantStaffAvailabilitySlotRow[]; error: string | null }> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { data: [], error: "Ungültige Restaurant-ID." };
  }
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("restaurant_staff_availability_slots")
    .select(SLOT_SELECT)
    .eq("restaurant_id", restaurantId)
    .eq("staff_id", staffId)
    .order("weekday", { ascending: true, nullsFirst: false })
    .order("service_date", { ascending: true, nullsFirst: false })
    .order("start_time", { ascending: true });

  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((row) => mapSlotRow(row as Record<string, unknown>)),
    error: null,
  };
}

export async function fetchStaffAvailabilitySlotsForRestaurant(
  restaurantId: string,
  opts?: { staffId?: string },
): Promise<{ data: RestaurantStaffAvailabilitySlotRow[]; error: string | null }> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { data: [], error: "Ungültige Restaurant-ID." };
  }
  const sb = createSupabaseBrowserClient();
  let q = sb
    .from("restaurant_staff_availability_slots")
    .select(SLOT_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("staff_id")
    .order("weekday", { ascending: true, nullsFirst: false })
    .order("service_date", { ascending: true, nullsFirst: false })
    .order("start_time", { ascending: true });

  if (opts?.staffId) {
    q = q.eq("staff_id", opts.staffId);
  }

  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((row) => mapSlotRow(row as Record<string, unknown>)),
    error: null,
  };
}

export async function createStaffAvailabilitySlot(
  input: CreateStaffAvailabilitySlotInput,
): Promise<{ data: RestaurantStaffAvailabilitySlotRow | null; error: string | null }> {
  const startTime = normalizeHmInput(input.startTime);
  const endTime = normalizeHmInput(input.endTime);
  if (!startTime || !endTime) {
    return { data: null, error: "Ungültige Uhrzeit." };
  }
  if (endTime <= startTime) {
    return { data: null, error: "Ende muss nach Beginn liegen." };
  }

  const weekday =
    input.kind === "weekly" ? (input.weekday ?? null) : null;
  const serviceDate =
    input.kind === "date" ? (input.serviceDate?.trim() ?? null) : null;

  if (input.kind === "weekly" && !weekday) {
    return { data: null, error: "Wochentag fehlt." };
  }
  if (input.kind === "date" && !serviceDate) {
    return { data: null, error: "Datum fehlt." };
  }

  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("restaurant_staff_availability_slots")
    .insert({
      restaurant_id: input.restaurantId,
      staff_id: input.staffId,
      weekday,
      service_date: serviceDate,
      start_time: startTime,
      end_time: endTime,
      note: input.note?.trim() || null,
    })
    .select(SLOT_SELECT)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: mapSlotRow(data as Record<string, unknown>), error: null };
}

export async function deleteStaffAvailabilitySlot(
  slotId: string,
): Promise<{ error: string | null }> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb
    .from("restaurant_staff_availability_slots")
    .delete()
    .eq("id", slotId);
  if (error) return { error: error.message };
  return { error: null };
}
