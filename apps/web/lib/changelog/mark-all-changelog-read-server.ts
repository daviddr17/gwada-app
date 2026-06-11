import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Beim Besuch der Changelog-Seite: alle Kunden-Einträge als gelesen. */
export async function markAllChangelogReadForUserServer(
  sb: SupabaseClient,
  params: { userId: string },
): Promise<{ error: string | null; count: number }> {
  const { data: entries, error: entriesError } = await sb
    .from("platform_changelog_entries")
    .select("id")
    .eq("audience", "customers");

  if (entriesError) {
    return { error: entriesError.message, count: 0 };
  }

  const ids = (entries ?? []).map((row) => (row as { id: string }).id);
  if (ids.length === 0) {
    return { error: null, count: 0 };
  }

  const { data: reads, error: readsError } = await sb
    .from("platform_changelog_reads")
    .select("changelog_entry_id")
    .eq("profile_id", params.userId)
    .in("changelog_entry_id", ids);

  if (readsError) {
    return { error: readsError.message, count: 0 };
  }

  const readIds = new Set(
    (reads ?? []).map(
      (row) => (row as { changelog_entry_id: string }).changelog_entry_id,
    ),
  );
  const unreadIds = ids.filter((id) => !readIds.has(id));
  if (unreadIds.length === 0) {
    return { error: null, count: 0 };
  }

  const rows = unreadIds.map((changelogEntryId) => ({
    profile_id: params.userId,
    changelog_entry_id: changelogEntryId,
  }));

  const { error } = await sb
    .from("platform_changelog_reads")
    .upsert(rows, { onConflict: "profile_id,changelog_entry_id" });

  return {
    error: error?.message ?? null,
    count: error ? 0 : unreadIds.length,
  };
}
