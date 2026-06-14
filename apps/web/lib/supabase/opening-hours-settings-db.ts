import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ensureBrowserSupabaseSession } from "@/lib/supabase/ensure-browser-session";
import { OPENING_HOURS_EMBED_FOOTER_MAX } from "@/lib/constants/opening-hours-embed";

export type OpeningHoursSettingsRow = {
  embedFooterText: string;
  embedShowKitchenHours: boolean;
  embedShowExceptions: boolean;
  /** Reguläre Öffnungszeiten beim Speichern an Google übertragen (opt-in). */
  syncGoogleOnSave: boolean;
  /** Reguläre Öffnungszeiten beim Speichern an Facebook übertragen (opt-in). */
  syncFacebookOnSave: boolean;
};

export const defaultOpeningHoursSettingsRow = (): OpeningHoursSettingsRow => ({
  embedFooterText: "",
  embedShowKitchenHours: true,
  embedShowExceptions: true,
  syncGoogleOnSave: false,
  syncFacebookOnSave: false,
});

export async function fetchOpeningHoursSettingsForRestaurant(
  restaurantId: string,
): Promise<OpeningHoursSettingsRow> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_opening_hours_settings")
    .select(
      "embed_footer_text, embed_show_kitchen_hours, embed_show_exceptions, sync_google_on_save, sync_facebook_on_save",
    )
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error || !data) {
    return defaultOpeningHoursSettingsRow();
  }

  return {
    embedFooterText: data.embed_footer_text ?? "",
    embedShowKitchenHours: data.embed_show_kitchen_hours ?? true,
    embedShowExceptions: data.embed_show_exceptions ?? true,
    syncGoogleOnSave: data.sync_google_on_save ?? false,
    syncFacebookOnSave: data.sync_facebook_on_save ?? false,
  };
}

export async function upsertOpeningHoursSettingsForRestaurant(
  restaurantId: string,
  row: OpeningHoursSettingsRow,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const footerTrim = row.embedFooterText.trim();
  if (footerTrim.length > OPENING_HOURS_EMBED_FOOTER_MAX) {
    return {
      ok: false,
      error: `Hinweistext: maximal ${OPENING_HOURS_EMBED_FOOTER_MAX} Zeichen.`,
    };
  }

  const supabase = createSupabaseBrowserClient();
  const sessionOk = await ensureBrowserSupabaseSession(supabase);
  if (!sessionOk.ok) {
    return sessionOk;
  }

  const { error } = await supabase.from("restaurant_opening_hours_settings").upsert(
    {
      restaurant_id: restaurantId,
      embed_footer_text: footerTrim || null,
      embed_show_kitchen_hours: row.embedShowKitchenHours,
      embed_show_exceptions: row.embedShowExceptions,
      sync_google_on_save: row.syncGoogleOnSave,
      sync_facebook_on_save: row.syncFacebookOnSave,
    },
    { onConflict: "restaurant_id" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
