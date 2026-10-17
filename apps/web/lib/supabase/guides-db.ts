import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isMissingSchemaError } from "@/lib/supabase/schema-error";
import type {
  GuideUpsertInput,
  RestaurantGuideCategoryRow,
  RestaurantGuideRow,
  RestaurantGuideStepRow,
} from "@/lib/types/guides";

const GUIDE_SELECT =
  "id, restaurant_id, title, short_description, is_active, sort_order, category_id, linked_staff_todo_id, archived_at, created_by, created_at, updated_at";

const CATEGORY_SELECT =
  "id, restaurant_id, name, sort_order, is_active, created_at, updated_at";

const STEP_SELECT =
  "id, guide_id, restaurant_id, position, body, image_storage_path, image_mime, image_size_bytes, video_storage_path, video_mime, video_size_bytes, created_at, updated_at";

function mapGuideError(error: { message: string } | null | undefined): string | null {
  if (!error?.message) return null;
  if (isMissingSchemaError(error.message)) {
    return "Anleitungen sind in dieser Umgebung noch nicht verfügbar.";
  }
  if (error.message.includes("storage_quota_exceeded")) {
    return "Speicherlimit erreicht. Bitte Dateien löschen oder Plan upgraden.";
  }
  return error.message;
}

export async function fetchGuidesForRestaurant(
  restaurantId: string,
  options?: { includeArchived?: boolean; includeInactive?: boolean },
): Promise<{ data: RestaurantGuideRow[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  let query = supabase
    .from("restaurant_guides")
    .select(GUIDE_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (!options?.includeArchived) {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { data: [], error: mapGuideError(error) };
  }

  let rows = (data ?? []) as RestaurantGuideRow[];
  if (!options?.includeInactive) {
    // Keep inactive in dashboard lists — caller filters. No-op here.
  }

  const ids = rows.map((r) => r.id);
  if (ids.length === 0) {
    return { data: rows, error: null };
  }

  const { data: steps, error: stepsError } = await supabase
    .from("restaurant_guide_steps")
    .select(STEP_SELECT)
    .eq("restaurant_id", restaurantId)
    .in("guide_id", ids)
    .order("position", { ascending: true });

  if (stepsError) {
    return { data: rows, error: mapGuideError(stepsError) };
  }

  const byGuide = new Map<string, RestaurantGuideStepRow[]>();
  for (const step of (steps ?? []) as RestaurantGuideStepRow[]) {
    const list = byGuide.get(step.guide_id) ?? [];
    list.push(step);
    byGuide.set(step.guide_id, list);
  }

  rows = rows.map((g) => ({ ...g, steps: byGuide.get(g.id) ?? [] }));
  return { data: rows, error: null };
}

export async function fetchGuideById(
  restaurantId: string,
  guideId: string,
): Promise<{ data: RestaurantGuideRow | null; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_guides")
    .select(GUIDE_SELECT)
    .eq("restaurant_id", restaurantId)
    .eq("id", guideId)
    .maybeSingle();

  if (error) return { data: null, error: mapGuideError(error) };
  if (!data) return { data: null, error: null };

  const { data: steps, error: stepsError } = await supabase
    .from("restaurant_guide_steps")
    .select(STEP_SELECT)
    .eq("restaurant_id", restaurantId)
    .eq("guide_id", guideId)
    .order("position", { ascending: true });

  if (stepsError) return { data: null, error: mapGuideError(stepsError) };

  return {
    data: {
      ...(data as RestaurantGuideRow),
      steps: (steps ?? []) as RestaurantGuideStepRow[],
    },
    error: null,
  };
}

export async function upsertGuide(
  restaurantId: string,
  input: GuideUpsertInput,
  guideId?: string | null,
): Promise<{ data: RestaurantGuideRow | null; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const title = input.title.trim();
  if (!title) {
    return { data: null, error: "Titel ist erforderlich." };
  }

  const payload = {
    restaurant_id: restaurantId,
    title,
    short_description: input.short_description?.trim() || null,
    is_active: input.is_active ?? true,
    sort_order: input.sort_order ?? 0,
    category_id: input.category_id?.trim() || null,
    linked_staff_todo_id: input.linked_staff_todo_id ?? null,
  };

  let savedId = guideId ?? null;

  if (guideId) {
    const { data, error } = await supabase
      .from("restaurant_guides")
      .update(payload)
      .eq("id", guideId)
      .eq("restaurant_id", restaurantId)
      .select("id")
      .single();
    if (error) return { data: null, error: mapGuideError(error) };
    savedId = (data as { id: string } | null)?.id ?? guideId;
  } else {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("restaurant_guides")
      .insert({ ...payload, created_by: userData.user?.id ?? null })
      .select("id")
      .single();
    if (error) return { data: null, error: mapGuideError(error) };
    savedId = (data as { id: string } | null)?.id ?? null;
  }

  if (!savedId) return { data: null, error: "Speichern fehlgeschlagen." };

  const stepsSync = await replaceGuideSteps(restaurantId, savedId, input.steps);
  if (stepsSync.error) {
    return { data: null, error: stepsSync.error };
  }

  return fetchGuideById(restaurantId, savedId);
}

async function replaceGuideSteps(
  restaurantId: string,
  guideId: string,
  steps: GuideUpsertInput["steps"],
): Promise<{ error: string | null }> {
  const supabase = createSupabaseBrowserClient();

  const { data: existing, error: existingError } = await supabase
    .from("restaurant_guide_steps")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("guide_id", guideId);

  if (existingError) return { error: mapGuideError(existingError) };

  const keepIds = new Set(
    steps.map((s) => s.id).filter((id): id is string => Boolean(id)),
  );
  const toDelete = ((existing ?? []) as { id: string }[])
    .map((r) => r.id)
    .filter((id) => !keepIds.has(id));

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("restaurant_guide_steps")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("guide_id", guideId)
      .in("id", toDelete);
    if (error) return { error: mapGuideError(error) };
  }

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const body = step.body.trim();
    const base = {
      guide_id: guideId,
      restaurant_id: restaurantId,
      position: step.position ?? i,
      body,
      image_storage_path: step.clear_image
        ? null
        : (step.image_storage_path ?? undefined),
      image_mime: step.clear_image ? null : (step.image_mime ?? undefined),
      image_size_bytes: step.clear_image
        ? null
        : (step.image_size_bytes ?? undefined),
      video_storage_path: step.clear_video
        ? null
        : (step.video_storage_path ?? undefined),
      video_mime: step.clear_video ? null : (step.video_mime ?? undefined),
      video_size_bytes: step.clear_video
        ? null
        : (step.video_size_bytes ?? undefined),
    };

    if (step.id) {
      const updatePayload: Record<string, unknown> = {
        position: base.position,
        body: base.body,
      };
      if (step.clear_image || step.image_storage_path !== undefined) {
        updatePayload.image_storage_path = step.clear_image
          ? null
          : step.image_storage_path ?? null;
        updatePayload.image_mime = step.clear_image
          ? null
          : step.image_mime ?? null;
        updatePayload.image_size_bytes = step.clear_image
          ? null
          : step.image_size_bytes ?? null;
      }
      if (step.clear_video || step.video_storage_path !== undefined) {
        updatePayload.video_storage_path = step.clear_video
          ? null
          : step.video_storage_path ?? null;
        updatePayload.video_mime = step.clear_video
          ? null
          : step.video_mime ?? null;
        updatePayload.video_size_bytes = step.clear_video
          ? null
          : step.video_size_bytes ?? null;
      }
      const { error } = await supabase
        .from("restaurant_guide_steps")
        .update(updatePayload)
        .eq("id", step.id)
        .eq("guide_id", guideId)
        .eq("restaurant_id", restaurantId);
      if (error) return { error: mapGuideError(error) };
    } else {
      const { error } = await supabase.from("restaurant_guide_steps").insert({
        guide_id: guideId,
        restaurant_id: restaurantId,
        position: base.position,
        body: base.body,
        image_storage_path: step.image_storage_path ?? null,
        image_mime: step.image_mime ?? null,
        image_size_bytes: step.image_size_bytes ?? null,
        video_storage_path: step.video_storage_path ?? null,
        video_mime: step.video_mime ?? null,
        video_size_bytes: step.video_size_bytes ?? null,
      });
      if (error) return { error: mapGuideError(error) };
    }
  }

  return { error: null };
}

export async function setGuideActive(
  restaurantId: string,
  guideId: string,
  isActive: boolean,
): Promise<{ error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("restaurant_guides")
    .update({ is_active: isActive })
    .eq("id", guideId)
    .eq("restaurant_id", restaurantId);
  return { error: mapGuideError(error) };
}

export async function archiveGuide(
  restaurantId: string,
  guideId: string,
): Promise<{ error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("restaurant_guides")
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq("id", guideId)
    .eq("restaurant_id", restaurantId);
  return { error: mapGuideError(error) };
}

export async function fetchGuideCategoriesForRestaurant(
  restaurantId: string,
  options?: { includeInactive?: boolean },
): Promise<{ data: RestaurantGuideCategoryRow[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  let query = supabase
    .from("restaurant_guide_categories")
    .select(CATEGORY_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!options?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) {
    return { data: [], error: mapGuideError(error) };
  }
  return { data: (data ?? []) as RestaurantGuideCategoryRow[], error: null };
}

export async function upsertGuideCategory(
  restaurantId: string,
  input: { name: string; is_active?: boolean; sort_order?: number },
  categoryId?: string | null,
): Promise<{ data: RestaurantGuideCategoryRow | null; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const name = input.name.trim();
  if (!name) {
    return { data: null, error: "Name ist erforderlich." };
  }

  const payload = {
    restaurant_id: restaurantId,
    name,
    is_active: input.is_active ?? true,
    sort_order: input.sort_order ?? 0,
  };

  if (categoryId) {
    const { data, error } = await supabase
      .from("restaurant_guide_categories")
      .update({
        name: payload.name,
        is_active: payload.is_active,
        sort_order: payload.sort_order,
      })
      .eq("id", categoryId)
      .eq("restaurant_id", restaurantId)
      .select(CATEGORY_SELECT)
      .single();
    if (error) return { data: null, error: mapGuideError(error) };
    return { data: data as RestaurantGuideCategoryRow, error: null };
  }

  const { data: existing } = await supabase
    .from("restaurant_guide_categories")
    .select("sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSort =
    input.sort_order ??
    (typeof existing?.sort_order === "number" ? existing.sort_order + 1 : 0);

  const { data, error } = await supabase
    .from("restaurant_guide_categories")
    .insert({ ...payload, sort_order: nextSort })
    .select(CATEGORY_SELECT)
    .single();
  if (error) return { data: null, error: mapGuideError(error) };
  return { data: data as RestaurantGuideCategoryRow, error: null };
}

export async function reorderGuideCategories(
  restaurantId: string,
  orderedIds: string[],
): Promise<{ error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i]!;
    const { error } = await supabase
      .from("restaurant_guide_categories")
      .update({ sort_order: i })
      .eq("id", id)
      .eq("restaurant_id", restaurantId);
    if (error) return { error: mapGuideError(error) };
  }
  return { error: null };
}

export async function deleteGuideCategory(
  restaurantId: string,
  categoryId: string,
): Promise<{ error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("restaurant_guide_categories")
    .delete()
    .eq("id", categoryId)
    .eq("restaurant_id", restaurantId);
  return { error: mapGuideError(error) };
}
