import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PlatformChangelogAudience,
  PlatformChangelogEntry,
  PlatformChangelogEntryInput,
} from "@/lib/types/platform-changelog";

type ChangelogRow = {
  id: string;
  published_at: string;
  title: string;
  body: string;
  version: string | null;
  audience: PlatformChangelogAudience;
  created_at: string;
  updated_at: string;
};

const CHANGELOG_SELECT =
  "id, published_at, title, body, version, audience, created_at, updated_at";

function rowToEntry(row: ChangelogRow): PlatformChangelogEntry {
  return {
    id: row.id,
    publishedAt: row.published_at,
    title: row.title,
    body: row.body,
    version: row.version,
    audience: row.audience,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchPlatformChangelogEntries(
  client: SupabaseClient,
): Promise<{ entries: PlatformChangelogEntry[]; error: string | null }> {
  const { data, error } = await client
    .from("platform_changelog_entries")
    .select(CHANGELOG_SELECT)
    .order("published_at", { ascending: false });

  if (error) {
    return { entries: [], error: error.message };
  }

  return {
    entries: (data ?? []).map((row) => rowToEntry(row as ChangelogRow)),
    error: null,
  };
}

export async function createPlatformChangelogEntry(
  admin: SupabaseClient,
  input: PlatformChangelogEntryInput,
  createdBy: string,
): Promise<{ entry: PlatformChangelogEntry | null; error: string | null }> {
  const title = input.title.trim();
  if (!title) {
    return { entry: null, error: "title_required" };
  }

  const { data, error } = await admin
    .from("platform_changelog_entries")
    .insert({
      title,
      body: input.body.trim(),
      published_at: input.publishedAt,
      version: input.version?.trim() || null,
      audience: input.audience,
      created_by: createdBy,
    })
    .select(CHANGELOG_SELECT)
    .single();

  if (error || !data) {
    return { entry: null, error: error?.message ?? "insert_failed" };
  }

  return { entry: rowToEntry(data as ChangelogRow), error: null };
}

export async function updatePlatformChangelogEntry(
  admin: SupabaseClient,
  id: string,
  input: PlatformChangelogEntryInput,
): Promise<{ entry: PlatformChangelogEntry | null; error: string | null }> {
  const title = input.title.trim();
  if (!title) {
    return { entry: null, error: "title_required" };
  }

  const { data, error } = await admin
    .from("platform_changelog_entries")
    .update({
      title,
      body: input.body.trim(),
      published_at: input.publishedAt,
      version: input.version?.trim() || null,
      audience: input.audience,
    })
    .eq("id", id)
    .select(CHANGELOG_SELECT)
    .maybeSingle();

  if (error || !data) {
    return { entry: null, error: error?.message ?? "update_failed" };
  }

  return { entry: rowToEntry(data as ChangelogRow), error: null };
}

export async function deletePlatformChangelogEntry(
  admin: SupabaseClient,
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await admin
    .from("platform_changelog_entries")
    .delete()
    .eq("id", id);

  return { error: error?.message ?? null };
}
