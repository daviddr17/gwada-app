import { localDayKey } from "@/lib/staff/shift-schedule-range";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  RestaurantShiftScheduleSettingsRow,
  RestaurantShiftTemplateRow,
  RestaurantStaffScheduledShiftRow,
  StaffScheduledShiftStatus,
} from "@/lib/types/staff-shift-schedule";

const SHIFT_SELECT = `
  id,
  restaurant_id,
  staff_id,
  template_id,
  position_tag_id,
  label,
  starts_at,
  ends_at,
  status,
  note,
  series_id,
  responded_at,
  created_by,
  created_at,
  updated_at,
  template:restaurant_shift_templates (
    id,
    name,
    color,
    start_time,
    end_time
  )
`;

function mapShiftRow(r: Record<string, unknown>): RestaurantStaffScheduledShiftRow {
  const templateRaw = r.template as
    | {
        id: string;
        name: string;
        color: string;
        start_time: string;
        end_time: string;
      }
    | {
        id: string;
        name: string;
        color: string;
        start_time: string;
        end_time: string;
      }[]
    | null;
  const templateOne = Array.isArray(templateRaw) ? templateRaw[0] ?? null : templateRaw;

  return {
    id: r.id as string,
    restaurant_id: r.restaurant_id as string,
    staff_id: r.staff_id as string,
    template_id: (r.template_id as string | null) ?? null,
    position_tag_id: (r.position_tag_id as string | null) ?? null,
    label: (r.label as string | null) ?? null,
    starts_at: r.starts_at as string,
    ends_at: r.ends_at as string,
    status: r.status as StaffScheduledShiftStatus,
    note: (r.note as string | null) ?? null,
    series_id: (r.series_id as string | null) ?? null,
    responded_at: (r.responded_at as string | null) ?? null,
    created_by: (r.created_by as string | null) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    template: templateOne,
  };
}

function mapTemplateRow(r: Record<string, unknown>): RestaurantShiftTemplateRow {
  return {
    id: r.id as string,
    restaurant_id: r.restaurant_id as string,
    name: r.name as string,
    start_time: r.start_time as string,
    end_time: r.end_time as string,
    color: r.color as string,
    sort_order: r.sort_order as number,
    is_active: Boolean(r.is_active),
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

export async function fetchShiftScheduleSettings(
  restaurantId: string,
): Promise<{ data: RestaurantShiftScheduleSettingsRow | null; error: string | null }> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("restaurant_shift_schedule_settings")
    .select("restaurant_id, requires_acceptance, created_at, updated_at")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data as RestaurantShiftScheduleSettingsRow | null, error: null };
}

export async function upsertShiftScheduleSettings(
  restaurantId: string,
  requiresAcceptance: boolean,
): Promise<{ error: string | null }> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb.from("restaurant_shift_schedule_settings").upsert(
    {
      restaurant_id: restaurantId,
      requires_acceptance: requiresAcceptance,
    },
    { onConflict: "restaurant_id" },
  );
  return { error: error?.message ?? null };
}

export async function fetchShiftTemplates(
  restaurantId: string,
): Promise<{ data: RestaurantShiftTemplateRow[]; error: string | null }> {
  return fetchShiftTemplatesInternal(restaurantId, { activeOnly: true });
}

export async function fetchAllShiftTemplates(
  restaurantId: string,
): Promise<{ data: RestaurantShiftTemplateRow[]; error: string | null }> {
  return fetchShiftTemplatesInternal(restaurantId, { activeOnly: false });
}

async function fetchShiftTemplatesInternal(
  restaurantId: string,
  opts: { activeOnly: boolean },
): Promise<{ data: RestaurantShiftTemplateRow[]; error: string | null }> {
  const sb = createSupabaseBrowserClient();
  let q = sb
    .from("restaurant_shift_templates")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("sort_order")
    .order("name");

  if (opts.activeOnly) {
    q = q.eq("is_active", true);
  }

  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((r) => mapTemplateRow(r as Record<string, unknown>)),
    error: null,
  };
}

export async function fetchScheduledShiftsInRange(
  restaurantId: string,
  rangeStartIso: string,
  rangeEndIso: string,
  opts?: { staffId?: string },
): Promise<{ data: RestaurantStaffScheduledShiftRow[]; error: string | null }> {
  const sb = createSupabaseBrowserClient();
  let q = sb
    .from("restaurant_staff_scheduled_shifts")
    .select(SHIFT_SELECT)
    .eq("restaurant_id", restaurantId)
    .gte("starts_at", rangeStartIso)
    .lt("starts_at", rangeEndIso)
    .order("starts_at");

  if (opts?.staffId) {
    q = q.eq("staff_id", opts.staffId);
  }

  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((r) => mapShiftRow(r as Record<string, unknown>)),
    error: null,
  };
}

/** Eindeutige geplante Mitarbeiter pro Kalendertag (ohne abgelehnte Schichten). */
export async function fetchScheduledStaffCountsByDayForRange(
  restaurantId: string,
  rangeStartIso: string,
  rangeEndExclusiveIso: string,
): Promise<{ data: Map<string, number>; error: string | null }> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("restaurant_staff_scheduled_shifts")
    .select("staff_id, starts_at, status")
    .eq("restaurant_id", restaurantId)
    .gte("starts_at", rangeStartIso)
    .lt("starts_at", rangeEndExclusiveIso);

  if (error) return { data: new Map(), error: error.message };

  const staffByDay = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    if ((row.status as string) === "declined") continue;
    const dayKey = localDayKey(new Date(row.starts_at as string));
    const bucket = staffByDay.get(dayKey) ?? new Set<string>();
    bucket.add(row.staff_id as string);
    staffByDay.set(dayKey, bucket);
  }

  const counts = new Map<string, number>();
  for (const [dayKey, staffIds] of staffByDay) {
    counts.set(dayKey, staffIds.size);
  }
  return { data: counts, error: null };
}

export type CreateScheduledShiftInput = {
  restaurantId: string;
  staffId: string;
  startsAt: string;
  endsAt: string;
  templateId?: string | null;
  label?: string | null;
  positionTagId?: string | null;
  note?: string | null;
  status?: StaffScheduledShiftStatus;
  seriesId?: string | null;
};

export async function createScheduledShift(
  input: CreateScheduledShiftInput,
): Promise<{ data: RestaurantStaffScheduledShiftRow | null; error: string | null }> {
  const sb = createSupabaseBrowserClient();
  const { data: auth } = await sb.auth.getUser();

  const { data, error } = await sb
    .from("restaurant_staff_scheduled_shifts")
    .insert({
      restaurant_id: input.restaurantId,
      staff_id: input.staffId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      template_id: input.templateId ?? null,
      label: input.label?.trim() || null,
      position_tag_id: input.positionTagId ?? null,
      note: input.note?.trim() || null,
      status: input.status ?? "confirmed",
      series_id: input.seriesId ?? null,
      created_by: auth.user?.id ?? null,
    })
    .select(SHIFT_SELECT)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: mapShiftRow(data as Record<string, unknown>), error: null };
}

export type UpdateScheduledShiftInput = {
  id: string;
  staffId?: string;
  startsAt?: string;
  endsAt?: string;
  templateId?: string | null;
  label?: string | null;
  positionTagId?: string | null;
  note?: string | null;
  status?: StaffScheduledShiftStatus;
};

export async function updateScheduledShift(
  input: UpdateScheduledShiftInput,
): Promise<{ data: RestaurantStaffScheduledShiftRow | null; error: string | null }> {
  const sb = createSupabaseBrowserClient();
  const patch: Record<string, unknown> = {};
  if (input.staffId != null) patch.staff_id = input.staffId;
  if (input.startsAt != null) patch.starts_at = input.startsAt;
  if (input.endsAt != null) patch.ends_at = input.endsAt;
  if (input.templateId !== undefined) patch.template_id = input.templateId;
  if (input.label !== undefined) patch.label = input.label?.trim() || null;
  if (input.positionTagId !== undefined) patch.position_tag_id = input.positionTagId;
  if (input.note !== undefined) patch.note = input.note?.trim() || null;
  if (input.status != null) {
    patch.status = input.status;
    if (input.status === "confirmed" || input.status === "declined") {
      patch.responded_at = new Date().toISOString();
    }
  }

  const { data, error } = await sb
    .from("restaurant_staff_scheduled_shifts")
    .update(patch)
    .eq("id", input.id)
    .select(SHIFT_SELECT)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: mapShiftRow(data as Record<string, unknown>), error: null };
}

export async function deleteScheduledShift(
  id: string,
): Promise<{ error: string | null }> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb
    .from("restaurant_staff_scheduled_shifts")
    .delete()
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function respondToScheduledShift(
  id: string,
  accept: boolean,
): Promise<{ error: string | null }> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb
    .from("restaurant_staff_scheduled_shifts")
    .update({
      status: accept ? "confirmed" : "declined",
      responded_at: new Date().toISOString(),
    })
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function copyScheduledShiftsToRange(
  restaurantId: string,
  sourceRangeStart: string,
  sourceRangeEnd: string,
  dayOffset: number,
  opts?: { staffId?: string; requiresAcceptance?: boolean },
): Promise<{ count: number; error: string | null }> {
  const { data: source, error: fetchError } = await fetchScheduledShiftsInRange(
    restaurantId,
    sourceRangeStart,
    sourceRangeEnd,
    opts?.staffId ? { staffId: opts.staffId } : undefined,
  );
  if (fetchError) return { count: 0, error: fetchError };
  if (source.length === 0) return { count: 0, error: null };

  const seriesId = crypto.randomUUID();
  const status: StaffScheduledShiftStatus = opts?.requiresAcceptance
    ? "pending"
    : "confirmed";
  const offsetMs = dayOffset * 24 * 60 * 60 * 1000;

  let created = 0;
  for (const shift of source) {
    const starts = new Date(new Date(shift.starts_at).getTime() + offsetMs);
    const ends = new Date(new Date(shift.ends_at).getTime() + offsetMs);
    const { error } = await createScheduledShift({
      restaurantId,
      staffId: shift.staff_id,
      startsAt: starts.toISOString(),
      endsAt: ends.toISOString(),
      templateId: shift.template_id,
      label: shift.label,
      positionTagId: shift.position_tag_id,
      note: shift.note,
      status,
      seriesId,
    });
    if (!error) created += 1;
  }

  return { count: created, error: null };
}

export async function upsertShiftTemplate(
  input: Omit<
    RestaurantShiftTemplateRow,
    "created_at" | "updated_at" | "id"
  > & {
    id?: string;
  },
): Promise<{ error: string | null }> {
  const sb = createSupabaseBrowserClient();
  const row = {
    id: input.id,
    restaurant_id: input.restaurant_id,
    name: input.name.trim(),
    start_time: input.start_time,
    end_time: input.end_time,
    color: input.color,
    sort_order: input.sort_order,
    is_active: input.is_active,
  };

  const { error } = input.id
    ? await sb.from("restaurant_shift_templates").update(row).eq("id", input.id)
    : await sb.from("restaurant_shift_templates").insert(row);

  return { error: error?.message ?? null };
}

export async function deleteShiftTemplate(
  id: string,
): Promise<{ error: string | null }> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb
    .from("restaurant_shift_templates")
    .update({ is_active: false })
    .eq("id", id);
  return { error: error?.message ?? null };
}
