import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  archiveChangelogDraft,
  readChangelogDraftFromRepo,
  type ChangelogDraftFile,
} from "@/lib/changelog/changelog-draft-file";
import {
  normalizeChangelogDraft,
  resolveDraftSourceGitSha,
} from "@/lib/changelog/changelog-entry-normalize";
import {
  draftSourceGitSha,
  extractChangelogPayloadsFromGit,
} from "@/lib/changelog/extract-changelog-from-git-server";
import { gitFieldsToChangelogPayload } from "@/lib/changelog/parse-changelog-from-commits";
import {
  syncChangelogItems,
  type ChangelogSyncItem,
} from "@/lib/changelog/sync-changelog-entries-server";
import type { PlatformChangelogAudience } from "@/lib/types/platform-changelog";

export const dynamic = "force-dynamic";

async function assertChangelogSyncAuth(
  req: Request,
): Promise<
  | { ok: true; userId: string | null }
  | { ok: false; status: number; error: string }
> {
  const secret = process.env.CHANGELOG_SYNC_SECRET?.trim();
  const auth = req.headers.get("authorization")?.trim();
  if (secret && auth === `Bearer ${secret}`) {
    return { ok: true, userId: null };
  }
  const superadmin = await assertSuperadminApi();
  if (!superadmin.ok) {
    return { ok: false, status: superadmin.status, error: superadmin.error };
  }
  return { ok: true, userId: superadmin.userId };
}

function parseDraft(value: unknown): ChangelogDraftFile | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const body = typeof o.body === "string" ? o.body.trim() : "";
  if (!title || !body) return null;
  const audience: PlatformChangelogAudience =
    o.audience === "superadmin" ? "superadmin" : "customers";
  const version =
    o.version === null || o.version === undefined
      ? null
      : typeof o.version === "string"
        ? o.version
        : null;
  return normalizeChangelogDraft({ title, body, audience, version });
}

function draftShaForSync(
  draft: ChangelogDraftFile,
  commitSha: string | null | undefined,
): string {
  return resolveDraftSourceGitSha(commitSha) ?? draftSourceGitSha(draft);
}

export async function POST(req: Request) {
  const auth = await assertChangelogSyncAuth(req);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    gitRecords?: unknown;
    draft?: unknown;
    runGit?: boolean;
    gitRange?: string;
    archiveDraft?: boolean;
    commitSha?: string;
  };

  const commitSha =
    (typeof body.commitSha === "string" ? body.commitSha.trim() : "") ||
    process.env.GITHUB_SHA?.trim() ||
    null;

  const items: ChangelogSyncItem[] = [];

  const draftFromBody = parseDraft(body.draft);
  const repoRoot = process.cwd();
  const draftFromFile = draftFromBody
    ? null
    : readChangelogDraftFromRepo(repoRoot);
  const draft = draftFromBody ?? (draftFromFile ? normalizeChangelogDraft(draftFromFile) : null);

  if (draft) {
    items.push({
      kind: "draft",
      payload: {
        ...draft,
        sourceGitSha: draftShaForSync(draft, commitSha),
      },
    });
  } else {
    if (body.runGit === true) {
      try {
        for (const payload of await extractChangelogPayloadsFromGit(
          body.gitRange,
        )) {
          items.push({ kind: "git", payload });
        }
      } catch (e) {
        const raw = e instanceof Error ? e.message : "git_failed";
        const message =
          raw.includes("not a git repository") ||
          raw.includes("ENOENT") ||
          raw.includes("spawn git") ||
          raw === "git_not_available"
            ? "Changelog-Quelle nicht erreichbar (weder lokales Git noch GitHub-API)."
            : raw;
        return Response.json({ error: message }, { status: 500 });
      }
    }

    if (Array.isArray(body.gitRecords)) {
      for (const record of body.gitRecords) {
        if (typeof record !== "string" || !record.trim()) continue;
        const fields = record.trim().split("\x1f");
        const payload = gitFieldsToChangelogPayload(fields);
        if (payload) items.push({ kind: "git", payload });
      }
    }
  }

  const result = await syncChangelogItems(admin, items, auth.userId);

  if (body.archiveDraft !== false && draftFromFile) {
    try {
      archiveChangelogDraft(repoRoot);
    } catch {
      /* ignore archive errors */
    }
  }

  return Response.json(result);
}
