import "server-only";

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_CHANGELOG_GIT_MAX_COMMITS,
  resolveChangelogGitCommitLimit,
} from "@/lib/changelog/changelog-git-range";
import { resolveChangelogGitRepoRoot } from "@/lib/changelog/changelog-git-repo-root";
import { extractChangelogPayloadsFromGithub } from "@/lib/changelog/extract-changelog-from-github-server";
import { gitFieldsToChangelogPayload } from "@/lib/changelog/parse-changelog-from-commits";
import type { GitCommitChangelogPayload } from "@/lib/changelog/parse-changelog-from-commits";

export { DEFAULT_CHANGELOG_GIT_MAX_COMMITS } from "@/lib/changelog/changelog-git-range";

export const GIT_LOG_FORMAT = "%H%x1f%s%x1f%b%x1f%aI%x1e";

function isGitAvailable(): boolean {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function localGitRepoRoot(): string | null {
  const cwd = process.cwd();
  if (existsSync(join(cwd, ".git"))) return cwd;
  const explicit = process.env.CHANGELOG_GIT_DIR?.trim();
  if (explicit && existsSync(join(explicit, ".git"))) return explicit;
  return null;
}

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

function extractChangelogPayloadsFromGitLog(
  range: string | null | undefined,
  repoRoot: string,
): GitCommitChangelogPayload[] {
  const output = execFileSync("git", buildGitLogArgs(range), {
    encoding: "utf8",
    cwd: repoRoot,
    maxBuffer: 10 * 1024 * 1024,
  });

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

/**
 * Lokal: `git log`. Production (ohne `.git`/git): GitHub Commits API.
 */
export async function extractChangelogPayloadsFromGit(
  range?: string | null,
  repoRoot?: string,
): Promise<GitCommitChangelogPayload[]> {
  let root = repoRoot ?? localGitRepoRoot();
  if (!root && isGitAvailable()) {
    try {
      root = resolveChangelogGitRepoRoot();
    } catch {
      root = null;
    }
  }

  if (root && isGitAvailable()) {
    try {
      return extractChangelogPayloadsFromGitLog(range, root);
    } catch (e) {
      if (repoRoot) throw e;
    }
  }

  try {
    return await extractChangelogPayloadsFromGithub(range);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "github_failed";
    if (msg === "github_api_401" || msg === "github_api_403") {
      throw new Error(
        "GitHub-API: Token fehlt oder ungültig (CHANGELOG_GIT_TOKEN / GITHUB_TOKEN).",
      );
    }
    if (msg.startsWith("github_api_")) {
      throw new Error(`GitHub-API nicht erreichbar (${msg.replace("github_api_", "")}).`);
    }
    throw e;
  }
}

/** Stabiler Dedup-Schlüssel für Draft-Inhalt — unabhängig vom Deploy-Commit. */
export function draftSourceGitSha(draft: {
  title: string;
  body: string;
  audience?: string;
  version?: string | null;
}): string {
  const stable = {
    title: draft.title,
    body: draft.body,
    audience: draft.audience ?? "customers",
    version: draft.version?.trim() || null,
  };
  const hash = createHash("sha256")
    .update(JSON.stringify(stable))
    .digest("hex")
    .slice(0, 24);
  return `draft:${hash}`;
}

export { resolveChangelogGitCommitLimit };
