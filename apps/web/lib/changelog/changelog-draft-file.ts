import { readFileSync, renameSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { PlatformChangelogAudience } from "@/lib/types/platform-changelog";

export const CHANGELOG_DRAFT_RELATIVE_PATH = "content/changelog.draft.json";

export type ChangelogDraftFile = {
  title: string;
  /** Was Endkunden betrifft — verständlich, ohne Technik. */
  body: string;
  /** Optional: Deploy, Migration, Interna — nur für Superadmins sichtbar. */
  superadminBody?: string;
  audience?: PlatformChangelogAudience;
  version?: string | null;
};

export function readChangelogDraftFromRepo(
  repoRoot: string,
): ChangelogDraftFile | null {
  const path = join(repoRoot, CHANGELOG_DRAFT_RELATIVE_PATH);
  if (!existsSync(path)) return null;

  try {
    const raw = readFileSync(path, "utf8");
    const data = JSON.parse(raw) as ChangelogDraftFile;
    if (!data?.title?.trim() || !data?.body?.trim()) return null;
    return {
      title: data.title.trim(),
      body: data.body.trim(),
      superadminBody:
        typeof data.superadminBody === "string"
          ? data.superadminBody.trim() || undefined
          : undefined,
      audience:
        data.audience === "superadmin" ? "superadmin" : "customers",
      version: data.version?.trim() || null,
    };
  } catch {
    return null;
  }
}

export function archiveChangelogDraft(repoRoot: string): void {
  const path = join(repoRoot, CHANGELOG_DRAFT_RELATIVE_PATH);
  if (!existsSync(path)) return;
  renameSync(path, `${path}.synced`);
}
