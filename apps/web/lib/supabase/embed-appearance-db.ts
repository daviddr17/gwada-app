import {
  DEFAULT_EMBED_TEXT_THEME,
  parseEmbedTextTheme,
  type EmbedAppearanceWidget,
  type EmbedTextTheme,
} from "@/lib/embed/embed-appearance";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ensureBrowserSupabaseSession } from "@/lib/supabase/ensure-browser-session";

export async function fetchEmbedTextThemeForRestaurant(
  restaurantId: string,
  widget: EmbedAppearanceWidget,
): Promise<EmbedTextTheme> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_embed_appearance")
    .select("text_theme")
    .eq("restaurant_id", restaurantId)
    .eq("widget", widget)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_EMBED_TEXT_THEME;
  }

  return parseEmbedTextTheme(data.text_theme as string | null);
}

export async function upsertEmbedTextThemeForRestaurant(
  restaurantId: string,
  widget: EmbedAppearanceWidget,
  textTheme: EmbedTextTheme,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createSupabaseBrowserClient();
  const sessionOk = await ensureBrowserSupabaseSession(supabase);
  if (!sessionOk.ok) {
    return sessionOk;
  }

  const { error } = await supabase.from("restaurant_embed_appearance").upsert(
    {
      restaurant_id: restaurantId,
      widget,
      text_theme: textTheme,
    },
    { onConflict: "restaurant_id,widget" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
