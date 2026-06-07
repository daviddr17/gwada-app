import "server-only";

import { resolveChangelogGitCommitLimit } from "@/lib/changelog/changelog-git-range";
import { gitCommitToChangelogPayload } from "@/lib/changelog/parse-changelog-from-commits";
import type { GitCommitChangelogPayload } from "@/lib/changelog/parse-changelog-from-commits";
import { raceWithTimeout } from "@/lib/supabase/race-timeout";
import { resolveGithubRepoSlug } from "@/lib/changelog/github-repo-slug";

const GITHUB_API_TIMEOUT_MS = 12_000;

function githubChangelogToken(): string | null {
  return (
    process.env.CHANGELOG_GIT_TOKEN?.trim() ||
    process.env.GITHUB_TOKEN?.trim() ||
    process.env.GITHUB_DEPLOY_TOKEN?.trim() ||
    null
  );
}

function githubRepoSlug(): string {
  return resolveGithubRepoSlug();
}

function githubChangelogBranch(): string {
  return (
    process.env.CHANGELOG_GIT_BRANCH?.trim() ||
    process.env.GWADA_DEPLOY_BRANCH?.trim() ||
    process.env.COOLIFY_BRANCH?.trim() ||
    process.env.GITHUB_REF_NAME?.trim()?.replace(/^refs\/heads\//, "") ||
    "main"
  );
}

type GithubCommitRow = {
  sha?: string;
  commit?: {
    message?: string;
    author?: { date?: string };
    committer?: { date?: string };
  };
};

async function githubFetchJson(path: string): Promise<unknown> {
  const token = githubChangelogToken();
  const res = await raceWithTimeout(
    fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    }),
    GITHUB_API_TIMEOUT_MS,
    "GitHub-Changelog",
  );

  if (!res.ok) {
    throw new Error(`github_api_${res.status}`);
  }

  return res.json() as Promise<unknown>;
}

function githubCommitToPayload(row: GithubCommitRow): GitCommitChangelogPayload | null {
  const sha = row.sha?.trim();
  const message = row.commit?.message ?? "";
  if (!sha || !message) return null;

  const newline = message.indexOf("\n");
  const subject = newline >= 0 ? message.slice(0, newline) : message;
  const body = newline >= 0 ? message.slice(newline + 1) : "";
  const committedAt =
    row.commit?.author?.date ??
    row.commit?.committer?.date ??
    new Date().toISOString();

  return gitCommitToChangelogPayload(sha, subject, body, committedAt);
}

/** Commits von GitHub API (Production ohne git im Container). */
export async function extractChangelogPayloadsFromGithub(
  range?: string | null,
): Promise<GitCommitChangelogPayload[]> {
  const repo = githubRepoSlug();
  const branch = githubChangelogBranch();
  const perPage = resolveChangelogGitCommitLimit(range);

  const rows = (await githubFetchJson(
    `/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=${perPage}`,
  )) as GithubCommitRow[];

  if (!Array.isArray(rows)) {
    throw new Error("github_api_invalid_response");
  }

  const payloads: GitCommitChangelogPayload[] = [];
  for (const row of [...rows].reverse()) {
    const payload = githubCommitToPayload(row);
    if (payload) payloads.push(payload);
  }
  return payloads;
}
