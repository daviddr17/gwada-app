import type { ChangelogDraftFile } from "@/lib/changelog/changelog-draft-file";
import {
  joinChangelogBody,
  parseChangelogBody,
} from "@/lib/changelog/changelog-body-sections";
import type {
  PlatformChangelogAudience,
  PlatformChangelogEntryInput,
} from "@/lib/types/platform-changelog";

/** Entfernt Markdown-Fettschrift — Changelog bleibt plain text. */
export function stripMarkdownBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*\*/g, "");
}

export function sanitizeChangelogText(text: string): string {
  return stripMarkdownBold(text).replace(/\s+/g, " ").trim();
}

export function sanitizeChangelogBody(body: string): string {
  return body
    .split("\n")
    .map((line) => stripMarkdownBold(line).trimEnd())
    .join("\n")
    .trim();
}

/** Version `YYYY.MM.DD` — Fallback wenn Draft keine Version setzt. */
export function defaultChangelogVersion(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}

export function resolveChangelogVersion(
  version: string | null | undefined,
  publishedAt: string,
): string {
  const trimmed = version?.trim();
  if (trimmed) return trimmed;
  const d = new Date(publishedAt);
  return defaultChangelogVersion(Number.isNaN(d.getTime()) ? new Date() : d);
}

export function normalizeChangelogDraft(
  draft: ChangelogDraftFile,
): ChangelogDraftFile {
  const { customerBody: parsedCustomer, superadminBody: parsedSuperadmin } =
    parseChangelogBody(draft.body);
  const customerBody = sanitizeChangelogBody(parsedCustomer);
  const explicitSuperadmin = sanitizeChangelogBody(draft.superadminBody ?? "");
  const superadminBody = sanitizeChangelogBody(
    explicitSuperadmin || parsedSuperadmin,
  );
  return {
    ...draft,
    title: sanitizeChangelogText(draft.title),
    body: joinChangelogBody(customerBody, superadminBody),
    superadminBody: superadminBody || undefined,
    audience:
      draft.audience === "superadmin"
        ? "superadmin"
        : ("customers" as PlatformChangelogAudience),
    version: draft.version?.trim() || defaultChangelogVersion(),
  };
}

export function normalizeChangelogEntryInput(
  input: PlatformChangelogEntryInput,
): PlatformChangelogEntryInput {
  return {
    ...input,
    title: sanitizeChangelogText(input.title),
    body: sanitizeChangelogBody(input.body),
    version: resolveChangelogVersion(input.version, input.publishedAt),
  };
}

const COMMIT_SHA_RE = /^[a-f0-9]{7,40}$/i;

/** Draft an Deploy-Commit koppeln (Dedup). */
export function resolveDraftSourceGitSha(
  commitSha: string | null | undefined,
): string | null {
  const trimmed = commitSha?.trim();
  if (trimmed && COMMIT_SHA_RE.test(trimmed)) return trimmed.toLowerCase();
  return null;
}
