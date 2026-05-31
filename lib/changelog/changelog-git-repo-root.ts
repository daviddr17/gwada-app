import "server-only";

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

const DEFAULT_REPO = "https://github.com/daviddr17/gwada-app.git";
const DEFAULT_BRANCH = "main";
const CLONE_DEPTH = 80;

function repoHasGit(root: string): boolean {
  return existsSync(join(root, ".git"));
}

function changelogGitBranch(): string {
  return (
    process.env.CHANGELOG_GIT_BRANCH?.trim() ||
    process.env.GITHUB_REF_NAME?.trim()?.replace(/^refs\/heads\//, "") ||
    DEFAULT_BRANCH
  );
}

function changelogCloneUrl(): string {
  const base = process.env.CHANGELOG_GIT_REPO?.trim() || DEFAULT_REPO;
  const token =
    process.env.CHANGELOG_GIT_TOKEN?.trim() ||
    process.env.GITHUB_TOKEN?.trim();
  if (token && base.startsWith("https://github.com/")) {
    return base.replace(
      "https://github.com/",
      `https://x-access-token:${token}@github.com/`,
    );
  }
  return base;
}

function cacheDir(): string {
  return (
    process.env.CHANGELOG_GIT_CACHE_DIR?.trim() ||
    join(tmpdir(), "gwada-changelog-git")
  );
}

function runGit(args: string[], cwd: string): void {
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function ensureShallowClone(): string {
  const dir = cacheDir();
  mkdirSync(dirname(dir), { recursive: true });
  const branch = changelogGitBranch();
  const url = changelogCloneUrl();

  if (!repoHasGit(dir)) {
    rmSync(dir, { recursive: true, force: true });
    runGit(
      [
        "clone",
        "--depth",
        String(CLONE_DEPTH),
        "--branch",
        branch,
        "--single-branch",
        url,
        dir,
      ],
      process.cwd(),
    );
    return dir;
  }

  try {
    runGit(["fetch", "--depth", String(CLONE_DEPTH), "origin", branch], dir);
    runGit(["reset", "--hard", `origin/${branch}`], dir);
  } catch {
    rmSync(dir, { recursive: true, force: true });
    runGit(
      [
        "clone",
        "--depth",
        String(CLONE_DEPTH),
        "--branch",
        branch,
        "--single-branch",
        url,
        dir,
      ],
      process.cwd(),
    );
  }

  return dir;
}

/**
 * Pfad mit `.git` für Changelog-Sync.
 * Lokal: Repo-Root. Production (Coolify ohne `.git`): Shallow-Clone-Cache.
 */
export function resolveChangelogGitRepoRoot(): string {
  const cwd = process.cwd();
  if (repoHasGit(cwd)) return cwd;

  const explicit = process.env.CHANGELOG_GIT_DIR?.trim();
  if (explicit && repoHasGit(explicit)) return explicit;

  return ensureShallowClone();
}
