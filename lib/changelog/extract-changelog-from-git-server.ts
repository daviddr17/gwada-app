import "server-only";

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolveChangelogGitRepoRoot } from "@/lib/changelog/changelog-git-repo-root";
import { gitFieldsToChangelogPayload } from "@/lib/changelog/parse-changelog-from-commits";
import type { GitCommitChangelogPayload } from "@/lib/changelog/parse-changelog-from-commits";

export const GIT_LOG_FORMAT = "%H%x1f%s%x1f%b%x1f%aI%x1e";
export const DEFAULT_CHANGELOG_GIT_MAX_COMMITS = 30;

/**
 * `HEAD~30..HEAD` scheitert bei wenigen Commits / Shallow-Clones.
 * `HEAD~N..HEAD` → letzte N Commits via `-N`; sonst Range unverändert.
 */
export function buildGitLogArgs(range?: string | null): string[] {
  const trimmed = range?.trim();
  const headRange = trimmed?.match(/^HEAD~(\d+)\.\.HEAD$/i);
  if (headRange) {
    const n = Number.parseInt(headRange[1] ?? "", 10);
    if (Number.isFinite(n) && n > 0) {
      return ["log", `-${n}`, `--format=${GIT_LOG_FORMAT}`, "--reverse"];
    }
  }
  if (trimmed && /^-\d+$/.test(trimmed)) {
    return ["log", trimmed, `--format=${GIT_LOG_FORMAT}`, "--reverse"];
  }
  if (trimmed) {
    return ["log", trimmed, `--format=${GIT_LOG_FORMAT}`, "--reverse"];
  }
  return [
    "log",
    `-${DEFAULT_CHANGELOG_GIT_MAX_COMMITS}`,
    `--format=${GIT_LOG_FORMAT}`,
    "--reverse",
  ];
}

export function extractChangelogPayloadsFromGit(
  range?: string | null,
  repoRoot?: string,
): GitCommitChangelogPayload[] {
  const root = repoRoot ?? resolveChangelogGitRepoRoot();
  const output = execFileSync("git", buildGitLogArgs(range), {
      encoding: "utf8",
      cwd: root,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  const payloads: GitCommitChangelogPayload[] = [];
  for (const record of output.split("\x1e")) {
    const trimmed = record.trim();
    if (!trimmed) continue;
    const fields = trimmed.split("\x1f");
    const payload = gitFieldsToChangelogPayload(fields);
    if (payload) payloads.push(payload);
  }
  return payloads;
}

export function draftSourceGitSha(draft: {
  title: string;
  body: string;
  audience?: string;
}): string {
  const hash = createHash("sha256")
    .update(JSON.stringify(draft))
    .digest("hex")
    .slice(0, 24);
  return `draft:${hash}`;
}
