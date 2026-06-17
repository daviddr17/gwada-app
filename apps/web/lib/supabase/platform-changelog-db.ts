import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PlatformChangelogAudience,
  PlatformChangelogEntry,
  PlatformChangelogEntryInput,
} from "@/lib/types/platform-changelog";
import { normalizeChangelogEntryInput } from "@/lib/changelog/changelog-entry-normalize";

type ChangelogRow = {
  id: string;
  published_at: string;
  title: string;
  body: string;
  version: string | null;
  audience: PlatformChangelogAudience;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

const CHANGELOG_SELECT =
  "id, published_at, title, body, version, audience, approved_at, created_at, updated_at";

function rowToEntry(row: ChangelogRow): PlatformChangelogEntry {
  return {
    id: row.id,
    publishedAt: row.published_at,
    title: row.title,
    body: row.body,
    version: row.version,
    audience: row.audience,
    approvedAt: row.approved_at,
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

export async function countPendingChangelogEntries(
  admin: SupabaseClient,
): Promise<{ count: number; error: string | null }> {
  const { count, error } = await admin
    .from("platform_changelog_entries")
    .select("id", { count: "exact", head: true })
    .is("approved_at", null);

  if (error) {
    return { count: 0, error: error.message };
  }

  return { count: count ?? 0, error: null };
}

export async function createPlatformChangelogEntry(
  admin: SupabaseClient,
  input: PlatformChangelogEntryInput,
  createdBy: string,
): Promise<{ entry: PlatformChangelogEntry | null; error: string | null }> {
  const normalized = normalizeChangelogEntryInput(input);
  const title = normalized.title.trim();
  if (!title) {
    return { entry: null, error: "title_required" };
  }

  const { data, error } = await admin
    .from("platform_changelog_entries")
    .insert({
      title,
      body: normalized.body,
      published_at: normalized.publishedAt,
      version: normalized.version,
      audience: normalized.audience,
      created_by: createdBy,
      approved_at: null,
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
  const normalized = normalizeChangelogEntryInput(input);
  const title = normalized.title.trim();
  if (!title) {
    return { entry: null, error: "title_required" };
  }

  const { data, error } = await admin
    .from("platform_changelog_entries")
    .update({
      title,
      body: normalized.body,
      published_at: normalized.publishedAt,
      version: normalized.version,
      audience: normalized.audience,
    })
    .eq("id", id)
    .select(CHANGELOG_SELECT)
    .maybeSingle();

  if (error || !data) {
    return { entry: null, error: error?.message ?? "update_failed" };
  }

  return { entry: rowToEntry(data as ChangelogRow), error: null };
}

export async function approvePlatformChangelogEntry(
  admin: SupabaseClient,
  id: string,
  approvedBy: string,
): Promise<{ entry: PlatformChangelogEntry | null; error: string | null }> {
  const { data, error } = await admin
    .from("platform_changelog_entries")
    .update({
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
    })
    .eq("id", id)
    .is("approved_at", null)
    .select(CHANGELOG_SELECT)
    .maybeSingle();

  if (error) {
    return { entry: null, error: error.message };
  }

  if (!data) {
    return { entry: null, error: "not_found_or_already_approved" };
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
