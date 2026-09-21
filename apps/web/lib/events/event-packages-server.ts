import "server-only";

import {
  isEventPackageKind,
  parseEventPackageMoney,
  sortEventPackages,
  type EventPackage,
  type EventPackageWriteFields,
  type PublicEventPackage,
} from "@/lib/events/event-package";
import type { SupabaseClient } from "@supabase/supabase-js";

const STAFF_COLUMNS =
  "id, restaurant_id, kind, name, description, price_per_person, tax_rate_percent, active, sort_order";

const PUBLIC_COLUMNS =
  "id, kind, name, description, price_per_person, sort_order";

type EventPackageRow = {
  id: string;
  restaurant_id?: string;
  kind: string;
  name: string;
  description: string | null;
  price_per_person: number | string;
  tax_rate_percent?: number | string;
  active?: boolean;
  sort_order: number;
};

function mapStaffRow(row: EventPackageRow): EventPackage | null {
  if (!isEventPackageKind(row.kind) || !row.restaurant_id) return null;
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    kind: row.kind,
    name: row.name.trim(),
    description: (row.description ?? "").trim(),
    pricePerPerson: parseEventPackageMoney(row.price_per_person),
    taxRatePercent: parseEventPackageMoney(row.tax_rate_percent),
    active: row.active !== false,
    sortOrder: Number(row.sort_order) || 0,
  };
}

function mapPublicRow(row: EventPackageRow): PublicEventPackage | null {
  if (!isEventPackageKind(row.kind)) return null;
  return {
    id: row.id,
    kind: row.kind,
    name: row.name.trim(),
    description: (row.description ?? "").trim(),
    pricePerPerson: parseEventPackageMoney(row.price_per_person),
  };
}

function writeRow(input: EventPackageWriteFields): Record<string, unknown> {
  return {
    kind: input.kind,
    name: input.name.trim(),
    description: (input.description ?? "").trim(),
    price_per_person: parseEventPackageMoney(input.pricePerPerson),
    tax_rate_percent: parseEventPackageMoney(input.taxRatePercent),
    active: input.active !== false,
    sort_order: input.sortOrder,
  };
}

export async function listEventPackagesForStaff(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<{ packages: EventPackage[]; error: string | null }> {
  const { data, error } = await sb
    .from("event_packages")
    .select(STAFF_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.warn("[gwada] list event packages", error.message);
    return { packages: [], error: "list_failed" };
  }
  const mapped = (data as EventPackageRow[])
    .map(mapStaffRow)
    .filter((row): row is EventPackage => row != null);
  return { packages: sortEventPackages(mapped), error: null };
}

export async function listActiveEventPackagesPublic(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<PublicEventPackage[]> {
  const { data, error } = await sb
    .from("event_packages")
    .select(PUBLIC_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.warn("[gwada] list public event packages", error.message);
    return [];
  }
  const sortable = (data as EventPackageRow[])
    .map((row) => {
      const mapped = mapPublicRow({ ...row, restaurant_id: restaurantId });
      if (!mapped) return null;
      return { ...mapped, sortOrder: Number(row.sort_order) || 0 };
    })
    .filter(
      (row): row is PublicEventPackage & { sortOrder: number } => row != null,
    );
  return sortEventPackages(sortable).map(
    ({ id, kind, name, description, pricePerPerson }) => ({
      id,
      kind,
      name,
      description,
      pricePerPerson,
    }),
  );
}

export async function createEventPackage(
  sb: SupabaseClient,
  restaurantId: string,
  input: EventPackageWriteFields,
): Promise<{ package: EventPackage | null; error: string | null }> {
  const { data, error } = await sb
    .from("event_packages")
    .insert({ restaurant_id: restaurantId, ...writeRow(input) })
    .select(STAFF_COLUMNS)
    .single();

  if (error || !data) {
    console.warn("[gwada] create event package", error?.message);
    return { package: null, error: "create_failed" };
  }
  const mapped = mapStaffRow(data as EventPackageRow);
  return mapped
    ? { package: mapped, error: null }
    : { package: null, error: "create_failed" };
}

export async function updateEventPackage(
  sb: SupabaseClient,
  restaurantId: string,
  packageId: string,
  input: EventPackageWriteFields,
): Promise<{ package: EventPackage | null; error: string | null }> {
  const { data, error } = await sb
    .from("event_packages")
    .update(writeRow(input))
    .eq("restaurant_id", restaurantId)
    .eq("id", packageId)
    .select(STAFF_COLUMNS)
    .maybeSingle();

  if (error) {
    console.warn("[gwada] update event package", error.message);
    return { package: null, error: "update_failed" };
  }
  if (!data) return { package: null, error: "not_found" };
  const mapped = mapStaffRow(data as EventPackageRow);
  return mapped
    ? { package: mapped, error: null }
    : { package: null, error: "update_failed" };
}

export async function deleteEventPackage(
  sb: SupabaseClient,
  restaurantId: string,
  packageId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await sb
    .from("event_packages")
    .delete()
    .eq("restaurant_id", restaurantId)
    .eq("id", packageId);

  if (error) {
    console.warn("[gwada] delete event package", error.message);
    return { ok: false, error: "delete_failed" };
  }
  return { ok: true, error: null };
}

export async function loadActiveEventPackagesByIds(
  sb: SupabaseClient,
  restaurantId: string,
  packageIds: string[],
): Promise<EventPackage[] | null> {
  if (packageIds.length === 0) return [];
  const uniqueIds = [...new Set(packageIds)];
  const { data, error } = await sb
    .from("event_packages")
    .select(STAFF_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .eq("active", true)
    .in("id", uniqueIds);

  if (error) {
    console.warn("[gwada] load event packages by id", error.message);
    return null;
  }
  const mapped = (data as EventPackageRow[])
    .map(mapStaffRow)
    .filter((row): row is EventPackage => row != null);
  if (mapped.length !== uniqueIds.length) return null;
  const byId = new Map(mapped.map((pkg) => [pkg.id, pkg]));
  return uniqueIds
    .map((id) => byId.get(id))
    .filter((pkg): pkg is EventPackage => pkg != null);
}
