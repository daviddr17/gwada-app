import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GitCommitChangelogPayload } from "@/lib/changelog/parse-changelog-from-commits";
import type { ChangelogDraftFile } from "@/lib/changelog/changelog-draft-file";
import type {
  PlatformChangelogEntry,
  PlatformChangelogEntryInput,
} from "@/lib/types/platform-changelog";

const CHANGELOG_SELECT =
  "id, published_at, title, body, version, audience, created_at, updated_at, source_git_sha";

type ChangelogRow = {
  id: string;
  published_at: string;
  title: string;
  body: string;
  version: string | null;
  audience: PlatformChangelogEntry["audience"];
  created_at: string;
  updated_at: string;
  source_git_sha: string | null;
};

function rowToEntry(row: ChangelogRow): PlatformChangelogEntry & {
  sourceGitSha: string | null;
} {
  return {
    id: row.id,
    publishedAt: row.published_at,
    title: row.title,
    body: row.body,
    version: row.version,
    audience: row.audience,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sourceGitSha: row.source_git_sha,
  };
}

export type ChangelogSyncItem =
  | {
      kind: "git";
      payload: GitCommitChangelogPayload;
    }
  | {
      kind: "draft";
      payload: ChangelogDraftFile & { sourceGitSha: string };
    };

export type ChangelogSyncResult = {
  created: PlatformChangelogEntry[];
  skipped: string[];
  errors: string[];
};

async function findByGitSha(
  admin: SupabaseClient,
  sha: string,
): Promise<boolean> {
  const { data } = await admin
    .from("platform_changelog_entries")
    .select("id")
    .eq("source_git_sha", sha)
    .maybeSingle();
  return Boolean(data);
}

async function insertEntry(
  admin: SupabaseClient,
  input: PlatformChangelogEntryInput & {
    sourceGitSha: string;
    publishedAt: string;
  },
  createdBy: string | null,
): Promise<{ entry: PlatformChangelogEntry | null; error: string | null }> {
  const { data, error } = await admin
    .from("platform_changelog_entries")
    .upsert(
      {
        title: input.title.trim(),
        body: input.body.trim(),
        published_at: input.publishedAt,
        version: input.version?.trim() || null,
        audience: input.audience,
        source_git_sha: input.sourceGitSha,
        created_by: createdBy,
      },
      { onConflict: "source_git_sha", ignoreDuplicates: true },
    )
    .select(CHANGELOG_SELECT)
    .maybeSingle();

  if (error) {
    return { entry: null, error: error.message ?? "insert_failed" };
  }

  if (!data) {
    const { data: existing } = await admin
      .from("platform_changelog_entries")
      .select(CHANGELOG_SELECT)
      .eq("source_git_sha", input.sourceGitSha)
      .maybeSingle();
    if (!existing) {
      return { entry: null, error: "insert_failed" };
    }
    const mappedExisting = rowToEntry(existing as ChangelogRow);
    const { sourceGitSha: _s2, ...entryExisting } = mappedExisting;
    return { entry: entryExisting, error: null };
  }

  const mapped = rowToEntry(data as ChangelogRow);
  const { sourceGitSha: _s, ...entry } = mapped;
  return { entry, error: null };
}

export async function syncChangelogItems(
  admin: SupabaseClient,
  items: ChangelogSyncItem[],
  createdBy: string | null,
): Promise<ChangelogSyncResult> {
  const result: ChangelogSyncResult = {
    created: [],
    skipped: [],
    errors: [],
  };

  for (const item of items) {
    const sha =
      item.kind === "git" ? item.payload.sha : item.payload.sourceGitSha;
    if (await findByGitSha(admin, sha)) {
      result.skipped.push(sha);
      continue;
    }

    const input: PlatformChangelogEntryInput & {
      sourceGitSha: string;
      publishedAt: string;
    } =
      item.kind === "git"
        ? {
            title: item.payload.title,
            body: item.payload.body,
            publishedAt: item.payload.committedAt,
            audience: item.payload.audience,
            version: null,
            sourceGitSha: item.payload.sha,
          }
        : {
            title: item.payload.title,
            body: item.payload.body,
            publishedAt: new Date().toISOString(),
            audience: item.payload.audience ?? "customers",
            version: item.payload.version ?? null,
            sourceGitSha: item.payload.sourceGitSha,
          };

    const { entry, error } = await insertEntry(admin, input, createdBy);
    if (error || !entry) {
      result.errors.push(`${sha}: ${error ?? "unknown"}`);
      continue;
    }
    result.created.push(entry);
  }

  return result;
}
