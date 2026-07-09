import { CONTACT_TAG_VIP_COLOR, CONTACT_TAG_VIP_SLUG } from "@/lib/constants/contact-tag-presets";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type ContactTagRow = {
  id: string;
  restaurant_id: string;
  slug: string | null;
  name: string;
  background_color: string;
  sort_order: number;
  is_system: boolean;
};

export type ContactTagAssignmentRow = {
  contact_id: string;
  tag_id: string;
  tag: ContactTagRow;
};

const TAG_SELECT =
  "id, restaurant_id, slug, name, background_color, sort_order, is_system";

function mapTagRow(row: Record<string, unknown>): ContactTagRow {
  return {
    id: row.id as string,
    restaurant_id: row.restaurant_id as string,
    slug: (row.slug as string | null) ?? null,
    name: row.name as string,
    background_color: row.background_color as string,
    sort_order: row.sort_order as number,
    is_system: row.is_system as boolean,
  };
}

/** Stellt sicher, dass der VIP-Systemtag existiert (idempotent). */
export async function ensureContactSystemTags(
  restaurantId: string,
): Promise<{ error: Error | null }> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { error: new Error("Ungültige Restaurant-ID.") };
  }
  const sb = createSupabaseBrowserClient();
  const { data: existing } = await sb
    .from("contact_tags")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("slug", CONTACT_TAG_VIP_SLUG)
    .maybeSingle();

  if (existing) return { error: null };

  const { error } = await sb.from("contact_tags").insert({
    restaurant_id: restaurantId,
    slug: CONTACT_TAG_VIP_SLUG,
    name: "VIP",
    background_color: CONTACT_TAG_VIP_COLOR,
    sort_order: 0,
    is_system: true,
  });

  if (error && !error.message.includes("duplicate")) {
    return { error: new Error(error.message) };
  }
  return { error: null };
}

export async function fetchContactTagsForRestaurant(
  restaurantId: string,
): Promise<{ data: ContactTagRow[]; error: Error | null }> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { data: [], error: null };
  }
  await ensureContactSystemTags(restaurantId);
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("contact_tags")
    .select(TAG_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return { data: [], error: new Error(error.message) };
  return {
    data: (data ?? []).map((r) => mapTagRow(r as Record<string, unknown>)),
    error: null,
  };
}

export async function fetchContactTagsByContactIds(
  restaurantId: string,
  contactIds: string[],
): Promise<{ data: Map<string, ContactTagRow[]>; error: Error | null }> {
  const map = new Map<string, ContactTagRow[]>();
  if (!isUuidRestaurantId(restaurantId) || contactIds.length === 0) {
    return { data: map, error: null };
  }

  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("contact_tag_assignments")
    .select(`contact_id, tag:contact_tags (${TAG_SELECT})`)
    .eq("restaurant_id", restaurantId)
    .in("contact_id", contactIds);

  if (error) return { data: map, error: new Error(error.message) };

  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const contactId = r.contact_id as string;
    const tagRaw = r.tag;
    const tag = Array.isArray(tagRaw)
      ? tagRaw[0]
      : tagRaw;
    if (!tag) continue;
    const mapped = mapTagRow(tag as Record<string, unknown>);
    const list = map.get(contactId) ?? [];
    list.push(mapped);
    map.set(contactId, list);
  }

  for (const [cid, tags] of map) {
    tags.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "de"));
    map.set(cid, tags);
  }

  return { data: map, error: null };
}

export async function createContactTag(params: {
  restaurantId: string;
  name: string;
  backgroundColor?: string;
}): Promise<{ data: ContactTagRow | null; error: Error | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: null, error: new Error("Ungültige Restaurant-ID.") };
  }
  const name = params.name.trim();
  if (!name) {
    return { data: null, error: new Error("Tag-Name fehlt.") };
  }

  const sb = createSupabaseBrowserClient();
  const { data: maxSort } = await sb
    .from("contact_tags")
    .select("sort_order")
    .eq("restaurant_id", params.restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = ((maxSort as { sort_order?: number } | null)?.sort_order ?? -1) + 1;

  const { data, error } = await sb
    .from("contact_tags")
    .insert({
      restaurant_id: params.restaurantId,
      name,
      background_color: params.backgroundColor ?? "#64748b",
      sort_order: sortOrder,
      is_system: false,
    })
    .select(TAG_SELECT)
    .single();

  if (error) return { data: null, error: new Error(error.message) };
  return { data: mapTagRow(data as Record<string, unknown>), error: null };
}

export async function setContactTagAssigned(params: {
  restaurantId: string;
  contactId: string;
  tagId: string;
  assigned: boolean;
}): Promise<{ error: Error | null }> {
  if (
    !isUuidRestaurantId(params.restaurantId) ||
    !isUuidRestaurantId(params.contactId) ||
    !isUuidRestaurantId(params.tagId)
  ) {
    return { error: new Error("Ungültige ID.") };
  }

  const sb = createSupabaseBrowserClient();
  if (params.assigned) {
    const { error } = await sb.from("contact_tag_assignments").upsert(
      {
        contact_id: params.contactId,
        tag_id: params.tagId,
        restaurant_id: params.restaurantId,
      },
      { onConflict: "contact_id,tag_id" },
    );
    if (error) return { error: new Error(error.message) };
    return { error: null };
  }

  const { error } = await sb
    .from("contact_tag_assignments")
    .delete()
    .eq("contact_id", params.contactId)
    .eq("tag_id", params.tagId)
    .eq("restaurant_id", params.restaurantId);

  if (error) return { error: new Error(error.message) };
  return { error: null };
}
