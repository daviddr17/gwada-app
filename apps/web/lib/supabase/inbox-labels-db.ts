import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type InboxLabelRow = {
  id: string;
  restaurant_id: string;
  name: string;
  background_color: string;
  sort_order: number;
  waha_label_id: string | null;
};

export type InboxLabelAssignmentRow = {
  thread_key: string;
  label_id: string;
  label: InboxLabelRow;
};

const LABEL_SELECT =
  "id, restaurant_id, name, background_color, sort_order, waha_label_id";

function mapLabelRow(row: Record<string, unknown>): InboxLabelRow {
  return {
    id: row.id as string,
    restaurant_id: row.restaurant_id as string,
    name: row.name as string,
    background_color: (row.background_color as string) || "#64748b",
    sort_order: (row.sort_order as number) ?? 0,
    waha_label_id: (row.waha_label_id as string | null) ?? null,
  };
}

export async function fetchInboxLabelsForRestaurant(
  restaurantId: string,
): Promise<{ data: InboxLabelRow[]; error: Error | null }> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { data: [], error: null };
  }
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("inbox_labels")
    .select(LABEL_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return { data: [], error: new Error(error.message) };
  return {
    data: (data ?? []).map((r) => mapLabelRow(r as Record<string, unknown>)),
    error: null,
  };
}

export async function fetchInboxLabelAssignmentsForThreads(
  restaurantId: string,
  threadKeys: string[],
): Promise<{ data: Map<string, InboxLabelRow[]>; error: Error | null }> {
  const map = new Map<string, InboxLabelRow[]>();
  if (!isUuidRestaurantId(restaurantId) || threadKeys.length === 0) {
    return { data: map, error: null };
  }

  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("inbox_label_assignments")
    .select(`thread_key, label:inbox_labels(${LABEL_SELECT})`)
    .eq("restaurant_id", restaurantId)
    .in("thread_key", threadKeys);

  if (error) return { data: map, error: new Error(error.message) };

  for (const row of data ?? []) {
    const r = row as {
      thread_key: string;
      label: Record<string, unknown> | Record<string, unknown>[] | null;
    };
    const labelRaw = Array.isArray(r.label) ? r.label[0] : r.label;
    if (!labelRaw) continue;
    const label = mapLabelRow(labelRaw);
    const list = map.get(r.thread_key) ?? [];
    list.push(label);
    map.set(r.thread_key, list);
  }

  for (const [key, list] of map) {
    list.sort(
      (a, b) =>
        a.sort_order - b.sort_order || a.name.localeCompare(b.name, "de"),
    );
    map.set(key, list);
  }

  return { data: map, error: null };
}

export async function createInboxLabelClient(params: {
  restaurantId: string;
  name: string;
  backgroundColor?: string;
}): Promise<{ data: InboxLabelRow | null; error: Error | null }> {
  const name = params.name.trim();
  if (!isUuidRestaurantId(params.restaurantId) || !name) {
    return { data: null, error: new Error("invalid_request") };
  }
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("inbox_labels")
    .insert({
      restaurant_id: params.restaurantId,
      name,
      background_color: params.backgroundColor ?? "#64748b",
    })
    .select(LABEL_SELECT)
    .single();

  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? "insert_failed") };
  }
  return { data: mapLabelRow(data as Record<string, unknown>), error: null };
}
