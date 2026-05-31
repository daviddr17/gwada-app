import "server-only";

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { gitFieldsToChangelogPayload } from "@/lib/changelog/parse-changelog-from-commits";
import type { GitCommitChangelogPayload } from "@/lib/changelog/parse-changelog-from-commits";

export const GIT_LOG_FORMAT = "%H%x1f%s%x1f%b%x1f%aI%x1e";

export function extractChangelogPayloadsFromGit(
  range: string,
  repoRoot?: string,
): GitCommitChangelogPayload[] {
  const output = execFileSync(
    "git",
    ["log", range, `--format=${GIT_LOG_FORMAT}`, "--reverse"],
    {
      encoding: "utf8",
      cwd: repoRoot,
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
