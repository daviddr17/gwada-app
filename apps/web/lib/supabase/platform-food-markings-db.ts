import type { SupabaseClient } from "@supabase/supabase-js";
import type { FoodMarkingDefinition } from "@/lib/menu/food-marking-catalog";
import type {
  PlatformFoodMarking,
  PlatformFoodMarkingInput,
} from "@/lib/types/platform-food-markings";

type Row = {
  id: string;
  country_code: string;
  code: string;
  kind: string;
  short_label: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const SELECT =
  "id, country_code, code, kind, short_label, label, sort_order, is_active, created_at, updated_at";

function mapRow(row: Row): PlatformFoodMarking {
  return {
    id: row.id,
    countryCode: row.country_code,
    code: row.code,
    kind: row.kind === "allergen" ? "allergen" : "additive",
    shortLabel: row.short_label,
    label: row.label,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function platformFoodMarkingToDefinition(
  row: PlatformFoodMarking,
): FoodMarkingDefinition {
  return {
    code: row.code,
    kind: row.kind,
    shortLabel: row.shortLabel,
    label: row.label,
  };
}

export async function fetchPlatformFoodMarkings(
  client: SupabaseClient,
  params?: { countryCode?: string; activeOnly?: boolean },
): Promise<{ markings: PlatformFoodMarking[]; error: string | null }> {
  let q = client
    .from("platform_food_marking_codes")
    .select(SELECT)
    .order("country_code")
    .order("sort_order")
    .order("code");

  if (params?.countryCode) {
    q = q.eq("country_code", params.countryCode.toUpperCase());
  }
  if (params?.activeOnly !== false) {
    q = q.eq("is_active", true);
  }

  const { data, error } = await q;
  if (error) return { markings: [], error: error.message };
  return {
    markings: (data ?? []).map((row) => mapRow(row as Row)),
    error: null,
  };
}

export async function fetchPlatformFoodMarking(
  client: SupabaseClient,
  id: string,
): Promise<{ marking: PlatformFoodMarking | null; error: string | null }> {
  const { data, error } = await client
    .from("platform_food_marking_codes")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) return { marking: null, error: error.message };
  if (!data) return { marking: null, error: "not_found" };
  return { marking: mapRow(data as Row), error: null };
}

export async function savePlatformFoodMarking(
  admin: SupabaseClient,
  input: PlatformFoodMarkingInput,
  markingId?: string | null,
): Promise<{ marking: PlatformFoodMarking | null; error: string | null }> {
  const countryCode = input.countryCode.trim().toUpperCase();
  const code = input.code.trim();
  const shortLabel = input.shortLabel.trim() || code;
  const label = input.label.trim();
  const kind = input.kind === "allergen" ? "allergen" : "additive";
  const sortOrder =
    typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)
      ? Math.trunc(input.sortOrder)
      : 0;
  const isActive = input.isActive !== false;

  if (countryCode.length !== 2 || !code || !label) {
    return { marking: null, error: "invalid_payload" };
  }

  if (markingId) {
    const { data, error } = await admin
      .from("platform_food_marking_codes")
      .update({
        country_code: countryCode,
        code,
        kind,
        short_label: shortLabel,
        label,
        sort_order: sortOrder,
        is_active: isActive,
      })
      .eq("id", markingId)
      .select(SELECT)
      .maybeSingle();

    if (error) return { marking: null, error: error.message };
    if (!data) return { marking: null, error: "not_found" };
    return { marking: mapRow(data as Row), error: null };
  }

  const { data, error } = await admin
    .from("platform_food_marking_codes")
    .insert({
      country_code: countryCode,
      code,
      kind,
      short_label: shortLabel,
      label,
      sort_order: sortOrder,
      is_active: isActive,
    })
    .select(SELECT)
    .maybeSingle();

  if (error) return { marking: null, error: error.message };
  if (!data) return { marking: null, error: "save_failed" };
  return { marking: mapRow(data as Row), error: null };
}

export async function deletePlatformFoodMarking(
  admin: SupabaseClient,
  markingId: string,
): Promise<{ error: string | null }> {
  const { error } = await admin
    .from("platform_food_marking_codes")
    .delete()
    .eq("id", markingId);
  return { error: error?.message ?? null };
}
