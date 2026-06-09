import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  RestaurantStaffContractLogEntry,
  RestaurantStaffWorkEntryLogEntry,
  RestaurantStaffContractRow,
  RestaurantStaffLogEntry,
  RestaurantStaffRow,
  RestaurantStaffWorkEntryRow,
  StaffLivePresenceRow,
  StaffPositionTagDefinition,
} from "@/lib/types/staff";

const STAFF_SELECT = `
  id,
  restaurant_id,
  profile_id,
  employee_id,
  position_tag_id,
  restaurant_position_id,
  given_name,
  family_name,
  birth_date,
  nationality,
  address_line1,
  address_line2,
  postal_code,
  city,
  country,
  email,
  phone,
  is_active,
  avatar_storage_path,
  created_at,
  position_tag:restaurant_staff_position_tags (
    id,
    name,
    background_color,
    is_active
  ),
  restaurant_position:restaurant_positions (
    id,
    name,
    slug
  ),
  linked_profile:profiles!profile_id (
    given_name,
    family_name,
    display_name
  ),
  linked_employee:restaurant_employees!employee_id (
    id,
    role,
    is_active,
    restaurant_position:restaurant_positions!position_id (
      id,
      name,
      slug
    )
  )
`;

const TAG_SELECT =
  "id,name,is_active,sort_order,background_color" as const;

function mapTagRow(r: {
  id: string;
  name: string;
  is_active: boolean;
  background_color: string;
}): StaffPositionTagDefinition {
  return {
    id: r.id,
    name: r.name,
    active: r.is_active,
    backgroundColor: r.background_color || "#64748b",
  };
}

function mapStaffRow(r: Record<string, unknown>): RestaurantStaffRow {
  const tagRaw = r.position_tag as
    | { id: string; name: string; background_color: string; is_active: boolean }
    | { id: string; name: string; background_color: string; is_active: boolean }[]
    | null;
  const tagOne = Array.isArray(tagRaw) ? tagRaw[0] ?? null : tagRaw;
  const posRaw = r.restaurant_position as
    | { id: string; name: string; slug: string }
    | { id: string; name: string; slug: string }[]
    | null;
  const posOne = Array.isArray(posRaw) ? posRaw[0] ?? null : posRaw;
  const profileRaw = r.linked_profile as
    | { given_name: string | null; family_name: string | null; display_name: string | null }
    | { given_name: string | null; family_name: string | null; display_name: string | null }[]
    | null;
  const profileOne = Array.isArray(profileRaw) ? profileRaw[0] ?? null : profileRaw;
  const empRaw = r.linked_employee as
    | {
        id: string;
        role: string;
        is_active: boolean;
        restaurant_position:
          | { id: string; name: string; slug: string }
          | { id: string; name: string; slug: string }[]
          | null;
      }
    | {
        id: string;
        role: string;
        is_active: boolean;
        restaurant_position:
          | { id: string; name: string; slug: string }
          | { id: string; name: string; slug: string }[]
          | null;
      }[]
    | null;
  const empOne = Array.isArray(empRaw) ? empRaw[0] ?? null : empRaw;
  const empPosRaw = empOne?.restaurant_position;
  const empPosOne = Array.isArray(empPosRaw) ? empPosRaw[0] ?? null : empPosRaw ?? null;

  return {
    id: r.id as string,
    restaurant_id: r.restaurant_id as string,
    profile_id: (r.profile_id as string | null) ?? null,
    employee_id: (r.employee_id as string | null) ?? null,
    position_tag_id: (r.position_tag_id as string | null) ?? null,
    restaurant_position_id: (r.restaurant_position_id as string | null) ?? null,
    given_name: r.given_name as string,
    family_name: r.family_name as string,
    birth_date: (r.birth_date as string | null) ?? null,
    nationality: (r.nationality as string | null) ?? null,
    address_line1: (r.address_line1 as string | null) ?? null,
    address_line2: (r.address_line2 as string | null) ?? null,
    postal_code: (r.postal_code as string | null) ?? null,
    city: (r.city as string | null) ?? null,
    country: (r.country as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    is_active: Boolean(r.is_active),
    avatar_storage_path: (r.avatar_storage_path as string | null) ?? null,
    created_at: r.created_at as string,
    position_tag: tagOne
      ? {
          id: tagOne.id,
          name: tagOne.name,
          background_color: tagOne.background_color,
          is_active: tagOne.is_active,
        }
      : null,
    restaurant_position: posOne
      ? { id: posOne.id, name: posOne.name, slug: posOne.slug }
      : null,
    linked_profile: profileOne
      ? {
          given_name: profileOne.given_name,
          family_name: profileOne.family_name,
          display_name: profileOne.display_name,
        }
      : null,
    linked_employee: empOne
      ? {
          id: empOne.id,
          role: empOne.role,
          is_active: empOne.is_active,
          restaurant_position: empPosOne
            ? {
                id: empPosOne.id,
                name: empPosOne.name,
                slug: empPosOne.slug,
              }
            : null,
        }
      : null,
  };
}

export async function loadStaffPositionTags(
  restaurantId: string,
): Promise<{ data: StaffPositionTagDefinition[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_staff_position_tags")
    .select(TAG_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map(mapTagRow), error: null };
}

export async function insertStaffPositionTag(
  restaurantId: string,
  name: string,
  active: boolean,
  backgroundColor: string,
): Promise<{ id: string } | null> {
  const supabase = createSupabaseBrowserClient();
  const { data: last } = await supabase
    .from("restaurant_staff_position_tags")
    .select("sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? -1) + 1;
  const { data, error } = await supabase
    .from("restaurant_staff_position_tags")
    .insert({
      restaurant_id: restaurantId,
      name,
      is_active: active,
      background_color: backgroundColor,
      sort_order: sortOrder,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return { id: data.id as string };
}

export async function updateStaffPositionTag(
  id: string,
  updates: {
    name?: string;
    active?: boolean;
    backgroundColor?: string;
  },
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name.trim();
  if (updates.active !== undefined) patch.is_active = updates.active;
  if (updates.backgroundColor !== undefined) {
    patch.background_color = updates.backgroundColor;
  }
  if (Object.keys(patch).length === 0) return true;
  const { error } = await supabase
    .from("restaurant_staff_position_tags")
    .update(patch)
    .eq("id", id);
  return !error;
}

export async function reorderStaffPositionTags(
  orderedIds: string[],
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("restaurant_staff_position_tags")
      .update({ sort_order: i })
      .eq("id", orderedIds[i]);
    if (error) return false;
  }
  return true;
}

export async function fetchStaffForRestaurant(
  restaurantId: string,
): Promise<{ data: RestaurantStaffRow[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_staff")
    .select(STAFF_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("family_name", { ascending: true })
    .order("given_name", { ascending: true });
  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((r) => mapStaffRow(r as Record<string, unknown>)),
    error: null,
  };
}

export async function fetchStaffById(
  restaurantId: string,
  staffId: string,
): Promise<{ data: RestaurantStaffRow | null; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_staff")
    .select(STAFF_SELECT)
    .eq("restaurant_id", restaurantId)
    .eq("id", staffId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };
  return { data: mapStaffRow(data as Record<string, unknown>), error: null };
}

export async function fetchStaffByProfileForRestaurant(
  restaurantId: string,
  profileId: string,
): Promise<{ data: RestaurantStaffRow | null; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_staff")
    .select(STAFF_SELECT)
    .eq("restaurant_id", restaurantId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };
  return { data: mapStaffRow(data as Record<string, unknown>), error: null };
}

export type StaffUpsertPayload = {
  given_name: string;
  family_name: string;
  birth_date?: string | null;
  nationality?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  is_active?: boolean;
  position_tag_id?: string | null;
  restaurant_position_id?: string | null;
  avatar_storage_path?: string | null;
};

export async function insertStaff(
  restaurantId: string,
  payload: StaffUpsertPayload,
): Promise<{ id: string } | null> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_staff")
    .insert({
      restaurant_id: restaurantId,
      ...payload,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return { id: data.id as string };
}

export async function updateStaff(
  staffId: string,
  payload: Partial<StaffUpsertPayload>,
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("restaurant_staff")
    .update(payload)
    .eq("id", staffId);
  return !error;
}

export async function fetchStaffLogEntries(
  restaurantId: string,
  staffId: string,
): Promise<{ data: RestaurantStaffLogEntry[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_staff_log_entries")
    .select("id, restaurant_id, staff_id, actor_user_id, action, details, created_at")
    .eq("restaurant_id", restaurantId)
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((r) => ({
      id: r.id as string,
      restaurant_id: r.restaurant_id as string,
      staff_id: r.staff_id as string,
      actor_user_id: (r.actor_user_id as string | null) ?? null,
      action: r.action as RestaurantStaffLogEntry["action"],
      details: (r.details as RestaurantStaffLogEntry["details"]) ?? {},
      created_at: r.created_at as string,
    })),
    error: null,
  };
}

const STAFF_CONTRACT_SELECT_BASE =
  "id, restaurant_id, staff_id, valid_from, valid_to, pay_type, hourly_rate_cents, fixed_salary_cents, currency, note";

const STAFF_CONTRACT_SELECT_EXTENDED = `${STAFF_CONTRACT_SELECT_BASE}, employment_type, vacation_days_per_year, target_weekly_minutes`;

export async function fetchStaffContracts(
  restaurantId: string,
  staffId: string,
): Promise<{ data: RestaurantStaffContractRow[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const extended = await supabase
    .from("restaurant_staff_contracts")
    .select(STAFF_CONTRACT_SELECT_EXTENDED)
    .eq("restaurant_id", restaurantId)
    .eq("staff_id", staffId)
    .order("valid_from", { ascending: false });
  let rows: Record<string, unknown>[] | null = extended.data as Record<
    string,
    unknown
  >[] | null;
  if (
    extended.error &&
    isMissingStaffContractColumnError(extended.error.message)
  ) {
    const legacy = await supabase
      .from("restaurant_staff_contracts")
      .select(STAFF_CONTRACT_SELECT_BASE)
      .eq("restaurant_id", restaurantId)
      .eq("staff_id", staffId)
      .order("valid_from", { ascending: false });
    if (legacy.error) return { data: [], error: legacy.error.message };
    rows = legacy.data as Record<string, unknown>[] | null;
  } else if (extended.error) {
    return { data: [], error: extended.error.message };
  }
  return {
    data: (rows ?? []).map((r) => mapStaffContractRow(r)),
    error: null,
  };
}

function normalizeStaffContractTargetWeeklyMinutes(
  value: unknown,
): number | null {
  if (value == null || value === "") return null;
  const minutes = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.round(minutes);
}

function mapStaffContractRow(r: Record<string, unknown>): RestaurantStaffContractRow {
  const validFrom = String(r.valid_from ?? "").slice(0, 10);
  const validToRaw = r.valid_to as string | null | undefined;
  const validTo = validToRaw ? validToRaw.slice(0, 10) : null;
  return {
    id: r.id as string,
    restaurant_id: r.restaurant_id as string,
    staff_id: r.staff_id as string,
    valid_from: validFrom,
    valid_to: validTo,
    pay_type: r.pay_type as RestaurantStaffContractRow["pay_type"],
    hourly_rate_cents: r.hourly_rate_cents as number | null,
    fixed_salary_cents: r.fixed_salary_cents as number | null,
    currency: (r.currency as string) ?? "EUR",
    note: (r.note as string | null) ?? null,
    employment_type:
      (r.employment_type as RestaurantStaffContractRow["employment_type"]) ??
      null,
    vacation_days_per_year:
      (r.vacation_days_per_year as number | null) ?? null,
    target_weekly_minutes: normalizeStaffContractTargetWeeklyMinutes(
      r.target_weekly_minutes,
    ),
  };
}

export async function fetchStaffContractsForRestaurant(
  restaurantId: string,
): Promise<{ data: RestaurantStaffContractRow[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const extended = await supabase
    .from("restaurant_staff_contracts")
    .select(STAFF_CONTRACT_SELECT_EXTENDED)
    .eq("restaurant_id", restaurantId)
    .order("valid_from", { ascending: false });
  let rows: Record<string, unknown>[] | null = extended.data as Record<
    string,
    unknown
  >[] | null;
  if (
    extended.error &&
    isMissingStaffContractColumnError(extended.error.message)
  ) {
    const legacy = await supabase
      .from("restaurant_staff_contracts")
      .select(STAFF_CONTRACT_SELECT_BASE)
      .eq("restaurant_id", restaurantId)
      .order("valid_from", { ascending: false });
    if (legacy.error) return { data: [], error: legacy.error.message };
    rows = legacy.data as Record<string, unknown>[] | null;
  } else if (extended.error) {
    return { data: [], error: extended.error.message };
  }
  return {
    data: (rows ?? []).map((r) => mapStaffContractRow(r)),
    error: null,
  };
}

export async function fetchStaffContractLogEntries(
  restaurantId: string,
  contractId: string,
): Promise<{
  data: RestaurantStaffContractLogEntry[];
  error: string | null;
}> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_staff_contract_log_entries")
    .select("id, restaurant_id, contract_id, actor_user_id, action, details, created_at")
    .eq("restaurant_id", restaurantId)
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((r) => ({
      id: r.id as string,
      restaurant_id: r.restaurant_id as string,
      contract_id: r.contract_id as string,
      actor_user_id: (r.actor_user_id as string | null) ?? null,
      action: r.action as RestaurantStaffContractLogEntry["action"],
      details: (r.details as RestaurantStaffContractLogEntry["details"]) ?? {},
      created_at: r.created_at as string,
    })),
    error: null,
  };
}

export async function fetchStaffWorkEntryLogEntries(
  restaurantId: string,
  workEntryIds: readonly string[],
): Promise<{
  data: RestaurantStaffWorkEntryLogEntry[];
  error: string | null;
}> {
  if (workEntryIds.length === 0) {
    return { data: [], error: null };
  }
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_staff_work_entry_log_entries")
    .select(
      "id, restaurant_id, work_entry_id, actor_user_id, action, details, created_at",
    )
    .eq("restaurant_id", restaurantId)
    .in("work_entry_id", [...workEntryIds])
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []).map((r) => ({
      id: r.id as string,
      restaurant_id: r.restaurant_id as string,
      work_entry_id: r.work_entry_id as string,
      actor_user_id: (r.actor_user_id as string | null) ?? null,
      action: r.action as RestaurantStaffWorkEntryLogEntry["action"],
      details: (r.details as RestaurantStaffWorkEntryLogEntry["details"]) ?? {},
      created_at: r.created_at as string,
    })),
    error: null,
  };
}

export type UpsertStaffContractResult =
  | { ok: true; id: string; usedLegacyFields?: boolean }
  | { ok: false; error: string };

function isMissingStaffContractColumnError(message: string): boolean {
  return /employment_type|vacation_days_per_year|target_weekly_minutes|contract_log/i.test(
    message,
  );
}

function buildStaffContractRow(
  restaurantId: string,
  staffId: string,
  payload: Omit<RestaurantStaffContractRow, "id" | "restaurant_id" | "staff_id">,
  includeExtendedFields: boolean,
) {
  const base = {
    restaurant_id: restaurantId,
    staff_id: staffId,
    valid_from: payload.valid_from,
    valid_to: payload.valid_to,
    pay_type: payload.pay_type,
    hourly_rate_cents:
      payload.pay_type === "hourly" ? payload.hourly_rate_cents : null,
    fixed_salary_cents:
      payload.pay_type === "fixed" ? payload.fixed_salary_cents : null,
    currency: payload.currency ?? "EUR",
    note: payload.note,
  };
  if (!includeExtendedFields) return base;
  return {
    ...base,
    employment_type: payload.employment_type,
    vacation_days_per_year: payload.vacation_days_per_year,
    target_weekly_minutes: payload.target_weekly_minutes,
  };
}

async function writeStaffContract(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  contractId: string | undefined,
  row: Record<string, unknown>,
): Promise<UpsertStaffContractResult> {
  if (contractId) {
    const { error } = await supabase
      .from("restaurant_staff_contracts")
      .update(row)
      .eq("id", contractId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: contractId };
  }
  const { data, error } = await supabase
    .from("restaurant_staff_contracts")
    .insert(row)
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Keine Antwort vom Server." };
  return { ok: true, id: data.id as string };
}

export async function upsertStaffContract(
  restaurantId: string,
  staffId: string,
  payload: Omit<RestaurantStaffContractRow, "id" | "restaurant_id" | "staff_id"> & {
    id?: string;
  },
): Promise<UpsertStaffContractResult> {
  const supabase = createSupabaseBrowserClient();
  const extendedRow = buildStaffContractRow(
    restaurantId,
    staffId,
    payload,
    true,
  );
  let result = await writeStaffContract(
    supabase,
    payload.id,
    extendedRow as Record<string, unknown>,
  );
  if (
    !result.ok &&
    isMissingStaffContractColumnError(result.error)
  ) {
    const legacyRow = buildStaffContractRow(
      restaurantId,
      staffId,
      payload,
      false,
    );
    result = await writeStaffContract(
      supabase,
      payload.id,
      legacyRow as Record<string, unknown>,
    );
    if (result.ok) {
      return { ok: true, id: result.id, usedLegacyFields: true };
    }
  }
  return result;
}

export async function deleteStaffContract(contractId: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("restaurant_staff_contracts")
    .delete()
    .eq("id", contractId);
  return !error;
}

export async function fetchStaffWorkEntriesInRange(
  restaurantId: string,
  staffId: string | null,
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<{ data: RestaurantStaffWorkEntryRow[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();

  // Überlappung mit [rangeStart, rangeEnd): offene Segmente + geschlossene Intervalle.
  let closedQ = supabase
    .from("restaurant_staff_work_entries")
    .select(
      "id, restaurant_id, staff_id, entry_type, starts_at, ends_at, note, is_open, shift_id",
    )
    .eq("restaurant_id", restaurantId)
    .eq("is_open", false)
    .lt("starts_at", rangeEndIso)
    .gt("ends_at", rangeStartIso)
    .order("starts_at", { ascending: true });

  let openQ = supabase
    .from("restaurant_staff_work_entries")
    .select(
      "id, restaurant_id, staff_id, entry_type, starts_at, ends_at, note, is_open, shift_id",
    )
    .eq("restaurant_id", restaurantId)
    .eq("is_open", true)
    .lt("starts_at", rangeEndIso)
    .order("starts_at", { ascending: true });

  if (staffId) {
    closedQ = closedQ.eq("staff_id", staffId);
    openQ = openQ.eq("staff_id", staffId);
  }

  const [{ data: closed, error: closedErr }, { data: open, error: openErr }] =
    await Promise.all([closedQ, openQ]);

  const error = closedErr?.message ?? openErr?.message ?? null;
  if (error) return { data: [], error };

  const mapRow = (r: Record<string, unknown>): RestaurantStaffWorkEntryRow => ({
    id: r.id as string,
    restaurant_id: r.restaurant_id as string,
    staff_id: r.staff_id as string,
    entry_type: r.entry_type as RestaurantStaffWorkEntryRow["entry_type"],
    starts_at: r.starts_at as string,
    ends_at: r.ends_at as string,
    note: (r.note as string | null) ?? null,
    is_open: Boolean(r.is_open),
    shift_id: (r.shift_id as string | null) ?? null,
  });

  const byId = new Map<string, RestaurantStaffWorkEntryRow>();
  for (const r of [...(closed ?? []), ...(open ?? [])]) {
    const row = mapRow(r as Record<string, unknown>);
    byId.set(row.id, row);
  }

  const merged = [...byId.values()].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );

  return { data: merged, error: null };
}

export async function fetchStaffLivePresence(
  restaurantId: string,
): Promise<{ data: StaffLivePresenceRow[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data: openEntries, error } = await supabase
    .from("restaurant_staff_work_entries")
    .select("staff_id, shift_id, entry_type, starts_at")
    .eq("restaurant_id", restaurantId)
    .eq("is_open", true)
    .not("shift_id", "is", null);

  if (error) return { data: [], error: error.message };

  const shiftIds = [
    ...new Set(
      (openEntries ?? [])
        .map((row) => row.shift_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const shiftClockInById = new Map<string, string>();
  if (shiftIds.length > 0) {
    const { data: shiftRows, error: shiftErr } = await supabase
      .from("restaurant_staff_work_entries")
      .select("shift_id, starts_at")
      .in("shift_id", shiftIds)
      .order("starts_at", { ascending: true });
    if (shiftErr) return { data: [], error: shiftErr.message };
    for (const row of shiftRows ?? []) {
      const shiftId = row.shift_id as string;
      if (!shiftClockInById.has(shiftId)) {
        shiftClockInById.set(shiftId, row.starts_at as string);
      }
    }
  }

  const byStaff = new Map<string, StaffLivePresenceRow>();
  for (const row of openEntries ?? []) {
    const staffId = row.staff_id as string;
    const shiftId = row.shift_id as string;
    const entryType = row.entry_type as "work" | "break";
    const startsAt = row.starts_at as string;
    const clockedInAt = shiftClockInById.get(shiftId) ?? startsAt;
    byStaff.set(staffId, {
      staff_id: staffId,
      status: entryType === "break" ? "on_break" : "working",
      clocked_in_at: clockedInAt,
      break_started_at: entryType === "break" ? startsAt : null,
    });
  }

  return { data: [...byStaff.values()], error: null };
}

export async function upsertStaffWorkEntry(
  restaurantId: string,
  staffId: string,
  payload: Omit<RestaurantStaffWorkEntryRow, "id" | "restaurant_id" | "staff_id"> & {
    id?: string;
  },
): Promise<{ id: string } | null> {
  const supabase = createSupabaseBrowserClient();
  const row = {
    restaurant_id: restaurantId,
    staff_id: staffId,
    entry_type: payload.entry_type,
    starts_at: payload.starts_at,
    ends_at: payload.ends_at,
    note: payload.note,
  };
  if (payload.id) {
    const { error } = await supabase
      .from("restaurant_staff_work_entries")
      .update(row)
      .eq("id", payload.id);
    return error ? null : { id: payload.id };
  }
  const { data, error } = await supabase
    .from("restaurant_staff_work_entries")
    .insert(row)
    .select("id")
    .single();
  if (error || !data) return null;
  return { id: data.id as string };
}

export async function deleteStaffWorkEntry(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("restaurant_staff_work_entries")
    .delete()
    .eq("id", id);
  return !error;
}

export function staffAvatarStoragePath(params: {
  restaurantId: string;
  staffId: string;
  ext: string;
}): string {
  const safeExt = params.ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  return `${params.restaurantId}/${params.staffId}/avatar.${safeExt}`;
}
