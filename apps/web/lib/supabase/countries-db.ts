import {
  COUNTRIES_REFERENCE_FALLBACK,
  type CountryReference,
} from "@/lib/constants/countries";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type CountryRow = CountryReference;

export async function fetchCountries(): Promise<{
  data: CountryRow[];
  error: Error | null;
}> {
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("countries")
    .select("iso2, name_de, dial_code, flag_emoji, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return { data: COUNTRIES_REFERENCE_FALLBACK, error: new Error(error.message) };
  }
  const rows = (data ?? []) as CountryRow[];
  if (rows.length === 0) {
    return { data: COUNTRIES_REFERENCE_FALLBACK, error: null };
  }
  return { data: rows, error: null };
}
