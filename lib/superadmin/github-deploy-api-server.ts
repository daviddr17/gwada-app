import "server-only";

import { raceWithTimeout } from "@/lib/supabase/race-timeout";
import { resolveGithubRepoSlug } from "@/lib/changelog/github-repo-slug";
import type {
  SuperadminGithubBranchInfo,
  SuperadminGithubDeployWorkflowRun,
  SuperadminGithubDeployWorkflowStatus,
  SuperadminGithubHeadCommit,
} from "@/lib/types/superadmin-ops-status";

const GITHUB_API_TIMEOUT_MS = 8_000;
export const APP_DEPLOY_WORKFLOW_FILE = "deploy-live-app.yml";
export const DB_DEPLOY_WORKFLOW_FILE = "deploy-live-db.yml";

export function githubDeployToken(): string | null {
  return (
    process.env.GITHUB_DEPLOY_TOKEN?.trim() ||
    process.env.GITHUB_TOKEN?.trim() ||
    null
  );
}

export function githubRepoSlug(): string {
  return resolveGithubRepoSlug();
}

export function githubDeployBranch(): string {
  return (
    process.env.GWADA_DEPLOY_BRANCH?.trim() ||
    process.env.COOLIFY_BRANCH?.trim() ||
    process.env.CHANGELOG_GIT_BRANCH?.trim() ||
    "main"
  );
}

export async function githubFetchJson(
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const token = githubDeployToken();
  if (!token) throw new Error("github_deploy_token_missing");

  const res = await raceWithTimeout(
    fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    }),
    GITHUB_API_TIMEOUT_MS,
    "GitHub-API",
  );

  if (!res.ok) {
    throw new Error(`github_api_${res.status}`);
  }

  return res.json() as Promise<unknown>;
}

function mapWorkflowRun(row: Record<string, unknown>): SuperadminGithubDeployWorkflowRun {
  return {
    id: typeof row.id === "number" ? row.id : 0,
    status: typeof row.status === "string" ? row.status : null,
    conclusion: typeof row.conclusion === "string" ? row.conclusion : null,
    htmlUrl: typeof row.html_url === "string" ? row.html_url : null,
    headSha: typeof row.head_sha === "string" ? row.head_sha : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    event: typeof row.event === "string" ? row.event : null,
  };
}

function pickActiveRun(
  runs: SuperadminGithubDeployWorkflowRun[],
): SuperadminGithubDeployWorkflowRun | null {
  return (
    runs.find(
      (run) =>
        run.status === "queued" ||
        run.status === "in_progress" ||
        run.status === "waiting" ||
        run.status === "requested" ||
        run.status === "pending",
    ) ?? null
  );
}

function githubApiErrorHint(msg: string): string {
  if (msg === "github_api_401" || msg === "github_api_403") {
    return "GITHUB_DEPLOY_TOKEN ungültig oder ohne Repo-/Workflow-Rechte.";
  }
  return "GitHub-API nicht erreichbar.";
}

export async function fetchGithubDeployWorkflowStatus(input: {
  workflowFile: string;
  label: string;
}): Promise<SuperadminGithubDeployWorkflowStatus> {
  const repo = githubRepoSlug();
  const branch = githubDeployBranch();
  const configured = Boolean(githubDeployToken());

  if (!configured) {
    return {
      configured: false,
      reachable: false,
      workflowFile: input.workflowFile,
      label: input.label,
      latestRun: null,
      activeRun: null,
      message:
        "GITHUB_DEPLOY_TOKEN in der App-Env setzen (repo + workflow scope).",
    };
  }

  try {
    const body = (await githubFetchJson(
      `/repos/${repo}/actions/workflows/${input.workflowFile}/runs?per_page=5`,
    )) as { workflow_runs?: Record<string, unknown>[] };

    const runs = (body.workflow_runs ?? []).map((row) =>
      mapWorkflowRun(row),
    );
    const latestRun = runs[0] ?? null;
    const activeRun = pickActiveRun(runs);

    return {
      configured: true,
      reachable: true,
      workflowFile: input.workflowFile,
      label: input.label,
      latestRun,
      activeRun,
      message: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "github_api_error";
    return {
      configured: true,
      reachable: false,
      workflowFile: input.workflowFile,
      label: input.label,
      latestRun: null,
      activeRun: null,
      message: githubApiErrorHint(msg),
    };
  }
}

export async function dispatchGithubLiveAppDeploy(
  ref?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = githubDeployToken();
  if (!token) {
    return {
      ok: false,
      error:
        "GITHUB_DEPLOY_TOKEN fehlt — Deploy kann nicht ausgelöst werden.",
    };
  }

  const repo = githubRepoSlug();
  const branch = ref?.trim() || githubDeployBranch();

  try {
    const active = await fetchGithubDeployWorkflowStatus({
      workflowFile: APP_DEPLOY_WORKFLOW_FILE,
      label: "App live",
    });
    if (active.activeRun) {
      return {
        ok: false,
        error: "Ein Deploy läuft bereits (GitHub Actions).",
      };
    }

    await githubFetchJson(
      `/repos/${repo}/actions/workflows/${APP_DEPLOY_WORKFLOW_FILE}/dispatches`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: branch }),
      },
    );

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "dispatch_failed";
    if (msg === "github_api_404") {
      return {
        ok: false,
        error: `Workflow ${APP_DEPLOY_WORKFLOW_FILE} im Repo ${repo} nicht gefunden.`,
      };
    }
    return { ok: false, error: "GitHub-Deploy konnte nicht gestartet werden." };
  }
}

export async function fetchGithubHeadCommit(
  branch = githubDeployBranch(),
): Promise<SuperadminGithubHeadCommit & { reachable: boolean }> {
  const repo = githubRepoSlug();

  try {
    const res = await raceWithTimeout(
      fetch(
        `https://api.github.com/repos/${repo}/commits/${encodeURIComponent(branch)}`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            ...(githubDeployToken()
              ? { Authorization: `Bearer ${githubDeployToken()}` }
              : {}),
          },
          cache: "no-store",
        },
      ),
      GITHUB_API_TIMEOUT_MS,
      "GitHub-Commit",
    );

    if (!res.ok) {
      return {
        sha: null,
        shortSha: null,
        message: `GitHub-Commit nicht abrufbar (${res.status}).`,
        author: null,
        committedAt: null,
        htmlUrl: null,
        reachable: false,
      };
    }

    const body = (await res.json()) as {
      sha?: string;
      html_url?: string;
      commit?: {
        message?: string;
        author?: { name?: string; date?: string };
      };
    };
    const sha = body.sha?.trim() || null;
    return {
      sha,
      shortSha: sha ? sha.slice(0, 7) : null,
      message: body.commit?.message?.split("\n")[0]?.trim() || null,
      author: body.commit?.author?.name?.trim() || null,
      committedAt: body.commit?.author?.date ?? null,
      htmlUrl: body.html_url ?? null,
      reachable: true,
    };
  } catch {
    return {
      sha: null,
      shortSha: null,
      message: "GitHub-Commit nicht erreichbar.",
      author: null,
      committedAt: null,
      htmlUrl: null,
      reachable: false,
    };
  }
}

export async function fetchGithubBranches(): Promise<{
  branches: SuperadminGithubBranchInfo[];
  defaultBranch: string;
  description: string | null;
  pushedAt: string | null;
  reachable: boolean;
  message: string | null;
}> {
  const repo = githubRepoSlug();
  const deployBranch = githubDeployBranch();
  const configured = Boolean(githubDeployToken());

  if (!configured) {
    return {
      branches: [],
      defaultBranch: deployBranch,
      description: null,
      pushedAt: null,
      reachable: false,
      message: "GITHUB_DEPLOY_TOKEN fehlt für Branch-Liste.",
    };
  }

  try {
    const [repoBody, branchBody] = await Promise.all([
      githubFetchJson(`/repos/${repo}`) as Promise<{
        default_branch?: string;
        description?: string | null;
        pushed_at?: string | null;
      }>,
      githubFetchJson(
        `/repos/${repo}/branches?per_page=30&sort=updated`,
      ) as Promise<
        {
          name?: string;
          protected?: boolean;
          commit?: { sha?: string };
        }[]
      >,
    ]);

    const defaultBranch = repoBody.default_branch?.trim() || deployBranch;
    const branches = (branchBody ?? []).map((row) => ({
      name: row.name ?? "—",
      shortSha: row.commit?.sha?.slice(0, 7) ?? "—",
      isDefault: row.name === defaultBranch,
      protected: Boolean(row.protected),
    }));

    return {
      branches,
      defaultBranch,
      description: repoBody.description ?? null,
      pushedAt: repoBody.pushed_at ?? null,
      reachable: true,
      message: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "github_api_error";
    return {
      branches: [],
      defaultBranch: deployBranch,
      description: null,
      pushedAt: null,
      reachable: false,
      message: githubApiErrorHint(msg),
    };
  }
}

/** @deprecated Use fetchGithubHeadCommit */
export async function fetchGithubMainCommitSha(): Promise<{
  sha: string | null;
  shortSha: string | null;
  message: string | null;
  reachable: boolean;
}> {
  const head = await fetchGithubHeadCommit();
  return {
    sha: head.sha,
    shortSha: head.shortSha,
    message: head.message,
    reachable: head.reachable,
  };
}

export type GithubDeployApiStatus = SuperadminGithubDeployWorkflowStatus;
