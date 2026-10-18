import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ensureBrowserSupabaseSession } from "@/lib/supabase/ensure-browser-session";
import { OPENING_HOURS_EMBED_FOOTER_MAX } from "@/lib/constants/opening-hours-embed";
import {
  normalizeOpeningHoursClosure,
  parseOpeningHoursClosure,
  validateOpeningHoursClosure,
  type OpeningHoursClosure,
  type OpeningHoursClosureMode,
} from "@/lib/opening-hours/closure";

export type OpeningHoursSettingsRow = {
  embedFooterText: string;
  embedShowKitchenHours: boolean;
  embedShowExceptions: boolean;
  /** Reguläre Öffnungszeiten beim Speichern an Google übertragen (opt-in). */
  syncGoogleOnSave: boolean;
  /** Reguläre Öffnungszeiten beim Speichern an Facebook übertragen (opt-in). */
  syncFacebookOnSave: boolean;
  closureMode: OpeningHoursClosureMode;
  closureFrom: string | null;
  closureUntil: string | null;
};

export const defaultOpeningHoursSettingsRow = (): OpeningHoursSettingsRow => ({
  embedFooterText: "",
  embedShowKitchenHours: true,
  embedShowExceptions: true,
  syncGoogleOnSave: false,
  syncFacebookOnSave: false,
  closureMode: "open",
  closureFrom: null,
  closureUntil: null,
});

const SETTINGS_COLUMNS =
  "embed_footer_text, embed_show_kitchen_hours, embed_show_exceptions, sync_google_on_save, sync_facebook_on_save, closure_mode, closure_from, closure_until";

export function closureFromSettingsRow(
  row: OpeningHoursSettingsRow,
): OpeningHoursClosure {
  return normalizeOpeningHoursClosure({
    mode: row.closureMode,
    from: row.closureFrom,
    until: row.closureUntil,
  });
}

export async function fetchOpeningHoursSettingsForRestaurant(
  restaurantId: string,
): Promise<OpeningHoursSettingsRow> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_opening_hours_settings")
    .select(SETTINGS_COLUMNS)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error || !data) {
    return defaultOpeningHoursSettingsRow();
  }

  const closure = parseOpeningHoursClosure(data);
  return {
    embedFooterText: data.embed_footer_text ?? "",
    embedShowKitchenHours: data.embed_show_kitchen_hours ?? true,
    embedShowExceptions: data.embed_show_exceptions ?? true,
    syncGoogleOnSave: data.sync_google_on_save ?? false,
    syncFacebookOnSave: data.sync_facebook_on_save ?? false,
    closureMode: closure.mode,
    closureFrom: closure.from,
    closureUntil: closure.until,
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

  const closure = normalizeOpeningHoursClosure({
    mode: row.closureMode,
    from: row.closureFrom,
    until: row.closureUntil,
  });
  const closureError = validateOpeningHoursClosure({
    mode: row.closureMode,
    from: row.closureFrom,
    until: row.closureUntil,
  });
  if (closureError) {
    return { ok: false, error: closureError };
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
      closure_mode: closure.mode,
      closure_from: closure.from,
      closure_until: closure.until,
    },
    { onConflict: "restaurant_id" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
