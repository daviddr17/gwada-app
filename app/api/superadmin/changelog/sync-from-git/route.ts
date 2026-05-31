import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  archiveChangelogDraft,
  readChangelogDraftFromRepo,
  type ChangelogDraftFile,
} from "@/lib/changelog/changelog-draft-file";
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
  return { title, body, audience, version };
}

function hashDraft(draft: ChangelogDraftFile): string {
  return draftSourceGitSha(draft);
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
  };

  const items: ChangelogSyncItem[] = [];

  if (body.runGit === true) {
    try {
      const range =
        typeof body.gitRange === "string" && body.gitRange.trim()
          ? body.gitRange.trim()
          : "HEAD~30..HEAD";
      for (const payload of extractChangelogPayloadsFromGit(range)) {
        items.push({ kind: "git", payload });
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : "git_failed";
      const message =
        raw.includes("not a git repository") ||
        raw.includes("ENOENT") ||
        raw.includes("spawn git")
          ? "Git-Repository nicht verfügbar. Auf Live: CHANGELOG_GIT_REPO setzen und git im Container installieren (oder npm run changelog:sync lokal / GitHub Action)."
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

  const draftFromBody = parseDraft(body.draft);
  if (draftFromBody) {
    items.push({
      kind: "draft",
      payload: {
        ...draftFromBody,
        sourceGitSha: hashDraft(draftFromBody),
      },
    });
  }

  const repoRoot = process.cwd();
  const draftFromFile = readChangelogDraftFromRepo(repoRoot);
  if (draftFromFile) {
    items.push({
      kind: "draft",
      payload: {
        ...draftFromFile,
        sourceGitSha: hashDraft(draftFromFile),
      },
    });
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
