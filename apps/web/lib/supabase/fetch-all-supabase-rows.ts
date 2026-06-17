import type { PostgrestError } from "@supabase/supabase-js";

const DEFAULT_PAGE_SIZE = 1000;

type RangeQueryResult<T> = {
  data: T[] | null;
  error: PostgrestError | null;
};

/**
 * Liest alle Zeilen einer Supabase-Abfrage (PostgREST-Limit ist standardmäßig 1000).
 */
export async function fetchAllSupabaseRows<T>(
  fetchPage: (from: number, to: number) => Promise<RangeQueryResult<T>>,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<{ data: T[]; error: string | null }> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) {
      return { data: rows, error: error.message };
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return { data: rows, error: null };
}
