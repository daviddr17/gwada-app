import type { PlatformChangelogAudience } from "@/lib/types/platform-changelog";

export type GitCommitChangelogPayload = {
  sha: string;
  subject: string;
  committedAt: string;
  audience: PlatformChangelogAudience;
  title: string;
  body: string;
};

const CHANGELOG_HEADER = /^changelog\s*:?\s*$/i;
const AUDIENCE_HEADER = /^changelog-audience\s*:\s*(customers|superadmin)\s*$/i;

function normalizeBullet(line: string): string {
  const t = line.trim();
  if (!t) return "";
  if (/^[-•*]\s+/.test(t)) return t.replace(/^[-•*]\s+/, "").trim();
  return t;
}

/** Commit-Body: optional `Changelog-Audience:` + Block `Changelog:` mit Bullet-Zeilen. */
export function parseChangelogFromCommitBody(
  body: string,
  subject: string,
): {
  audience: PlatformChangelogAudience;
  bullets: string[];
} | null {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  let audience: PlatformChangelogAudience = "customers";
  let inChangelog = false;
  const bullets: string[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    const audienceMatch = trimmed.match(AUDIENCE_HEADER);
    if (audienceMatch) {
      audience = audienceMatch[1] as PlatformChangelogAudience;
      continue;
    }

    if (CHANGELOG_HEADER.test(trimmed)) {
      inChangelog = true;
      continue;
    }

    if (inChangelog) {
      if (!trimmed) {
        if (bullets.length > 0) break;
        continue;
      }
      if (/^[a-z-]+:\s/i.test(trimmed) && !/^[-•*]/.test(trimmed)) {
        break;
      }
      const bullet = normalizeBullet(trimmed);
      if (bullet) bullets.push(bullet);
    }
  }

  if (bullets.length === 0) return null;

  return { audience, bullets };
}

export function gitCommitToChangelogPayload(
  sha: string,
  subject: string,
  body: string,
  committedAt: string,
): GitCommitChangelogPayload | null {
  const parsed = parseChangelogFromCommitBody(body, subject);
  if (!parsed) return null;

  const title =
    subject.trim() ||
    `Update ${new Date(committedAt).toLocaleDateString("de-DE")}`;

  return {
    sha,
    subject,
    committedAt,
    audience: parsed.audience,
    title,
    body: parsed.bullets.map((b) => `- ${b}`).join("\n"),
  };
}

/** Felder aus `git log --format=%H%x1f%s%x1f%b%x1f%aI%x1e`. */
export function gitFieldsToChangelogPayload(
  fields: string[],
): GitCommitChangelogPayload | null {
  if (fields.length < 4) return null;
  const [sha, subject, body, committedAt] = fields;
  if (!sha?.trim()) return null;
  return gitCommitToChangelogPayload(
    sha.trim(),
    subject ?? "",
    body ?? "",
    committedAt?.trim() || new Date().toISOString(),
  );
}
