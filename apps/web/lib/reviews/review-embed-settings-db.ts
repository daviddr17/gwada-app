import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ensureBrowserSupabaseSession } from "@/lib/supabase/ensure-browser-session";

export type ReviewEmbedViewMode = "grid" | "list";

export type ReviewEmbedSettingsRow = {
  defaultEmbedView: ReviewEmbedViewMode;
};

export const defaultReviewEmbedSettingsRow = (): ReviewEmbedSettingsRow => ({
  defaultEmbedView: "grid",
});

export function parseReviewEmbedViewMode(
  raw: string | null | undefined,
): ReviewEmbedViewMode {
  return raw === "list" ? "list" : "grid";
}

export async function fetchReviewEmbedSettingsForRestaurant(
  restaurantId: string,
): Promise<ReviewEmbedSettingsRow> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_review_settings")
    .select("default_embed_view")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error || !data) {
    return defaultReviewEmbedSettingsRow();
  }

  return {
    defaultEmbedView: parseReviewEmbedViewMode(
      data.default_embed_view as string | null,
    ),
  };
}

export async function upsertReviewEmbedSettingsForRestaurant(
  restaurantId: string,
  row: ReviewEmbedSettingsRow,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createSupabaseBrowserClient();
  const sessionOk = await ensureBrowserSupabaseSession(supabase);
  if (!sessionOk.ok) {
    return sessionOk;
  }

  const { error } = await supabase.from("restaurant_review_settings").upsert(
    {
      restaurant_id: restaurantId,
      default_embed_view: row.defaultEmbedView,
    },
    { onConflict: "restaurant_id" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
