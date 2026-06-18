import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GitCommitChangelogPayload } from "@/lib/changelog/parse-changelog-from-commits";
import type { ChangelogDraftFile } from "@/lib/changelog/changelog-draft-file";
import {
  normalizeChangelogDraft,
  resolveChangelogVersion,
  sanitizeChangelogBody,
  sanitizeChangelogText,
} from "@/lib/changelog/changelog-entry-normalize";
import type {
  PlatformChangelogEntry,
  PlatformChangelogEntryInput,
} from "@/lib/types/platform-changelog";

const CHANGELOG_SELECT =
  "id, published_at, title, body, version, audience, approved_at, created_at, updated_at, source_git_sha";

type ChangelogRow = {
  id: string;
  published_at: string;
  title: string;
  body: string;
  version: string | null;
  audience: PlatformChangelogEntry["audience"];
  approved_at: string | null;
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
    approvedAt: row.approved_at,
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

async function findByTitleAndVersion(
  admin: SupabaseClient,
  title: string,
  version: string,
): Promise<boolean> {
  const { data } = await admin
    .from("platform_changelog_entries")
    .select("id")
    .eq("title", title)
    .eq("version", version)
    .limit(1)
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
): Promise<{
  entry: PlatformChangelogEntry | null;
  error: string | null;
  duplicate?: boolean;
}> {
  const row = {
    title: sanitizeChangelogText(input.title),
    body: sanitizeChangelogBody(input.body),
    published_at: input.publishedAt,
    version: resolveChangelogVersion(input.version, input.publishedAt),
    audience: input.audience,
    source_git_sha: input.sourceGitSha,
    created_by: createdBy,
  };

  const { data, error } = await admin
    .from("platform_changelog_entries")
    .insert(row)
    .select(CHANGELOG_SELECT)
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { entry: null, error: null, duplicate: true };
    }
    return { entry: null, error: error.message ?? "insert_failed" };
  }

  if (!data) {
    return { entry: null, error: "insert_failed" };
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

  const hasDraft = items.some((item) => item.kind === "draft");
  const queue = hasDraft
    ? items.filter((item) => item.kind === "draft")
    : items;

  for (const item of queue) {
    const sha =
      item.kind === "git" ? item.payload.sha : item.payload.sourceGitSha;

    const input: PlatformChangelogEntryInput & {
      sourceGitSha: string;
      publishedAt: string;
    } =
      item.kind === "git"
        ? {
            title: sanitizeChangelogText(item.payload.title),
            body: sanitizeChangelogBody(item.payload.body),
            publishedAt: item.payload.committedAt,
            audience: item.payload.audience,
            version: resolveChangelogVersion(null, item.payload.committedAt),
            sourceGitSha: item.payload.sha,
          }
        : (() => {
            const draft = normalizeChangelogDraft(item.payload);
            const publishedAt = new Date().toISOString();
            return {
              title: draft.title,
              body: draft.body,
              publishedAt,
              audience: draft.audience ?? "customers",
              version: resolveChangelogVersion(draft.version, publishedAt),
              sourceGitSha: item.payload.sourceGitSha,
            };
          })();

    if (await findByGitSha(admin, sha)) {
      result.skipped.push(sha);
      continue;
    }

    if (
      item.kind === "draft" &&
      (await findByTitleAndVersion(admin, input.title, input.version))
    ) {
      result.skipped.push(sha);
      continue;
    }

    const { entry, error, duplicate } = await insertEntry(admin, input, createdBy);
    if (duplicate) {
      result.skipped.push(sha);
      continue;
    }
    if (error || !entry) {
      result.errors.push(`${sha}: ${error ?? "unknown"}`);
      continue;
    }
    result.created.push(entry);
  }

  return result;
}
