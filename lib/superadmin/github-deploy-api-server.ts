import "server-only";

import { raceWithTimeout } from "@/lib/supabase/race-timeout";

const GITHUB_API_TIMEOUT_MS = 8_000;
const DEPLOY_WORKFLOW_FILE = "deploy-live-app.yml";

export type GithubDeployWorkflowRun = {
  id: number;
  status: string | null;
  conclusion: string | null;
  htmlUrl: string | null;
  headSha: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  event: string | null;
};

export type GithubDeployApiStatus = {
  configured: boolean;
  reachable: boolean;
  repo: string;
  branch: string;
  latestRun: GithubDeployWorkflowRun | null;
  activeRun: GithubDeployWorkflowRun | null;
  message: string | null;
};

function githubDeployToken(): string | null {
  return (
    process.env.GITHUB_DEPLOY_TOKEN?.trim() ||
    process.env.GITHUB_TOKEN?.trim() ||
    null
  );
}

function githubRepoSlug(): string {
  return (
    process.env.GWADA_GITHUB_REPO?.trim() ||
    process.env.CHANGELOG_GIT_REPO?.trim()?.replace(
      /^https:\/\/github\.com\//,
      "",
    )?.replace(/\.git$/, "") ||
    "daviddr17/gwada-app"
  );
}

function githubDeployBranch(): string {
  return (
    process.env.GWADA_DEPLOY_BRANCH?.trim() ||
    process.env.COOLIFY_BRANCH?.trim() ||
    process.env.CHANGELOG_GIT_BRANCH?.trim() ||
    "main"
  );
}

async function githubFetchJson(path: string, init?: RequestInit): Promise<unknown> {
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

function mapWorkflowRun(row: Record<string, unknown>): GithubDeployWorkflowRun {
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
  runs: GithubDeployWorkflowRun[],
): GithubDeployWorkflowRun | null {
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

export async function fetchGithubDeployWorkflowStatus(): Promise<GithubDeployApiStatus> {
  const repo = githubRepoSlug();
  const branch = githubDeployBranch();
  const configured = Boolean(githubDeployToken());

  if (!configured) {
    return {
      configured: false,
      reachable: false,
      repo,
      branch,
      latestRun: null,
      activeRun: null,
      message:
        "GITHUB_DEPLOY_TOKEN in der App-Env setzen (repo + workflow scope).",
    };
  }

  try {
    const body = (await githubFetchJson(
      `/repos/${repo}/actions/workflows/${DEPLOY_WORKFLOW_FILE}/runs?per_page=5`,
    )) as { workflow_runs?: Record<string, unknown>[] };

    const runs = (body.workflow_runs ?? []).map((row) =>
      mapWorkflowRun(row),
    );
    const latestRun = runs[0] ?? null;
    const activeRun = pickActiveRun(runs);

    return {
      configured: true,
      reachable: true,
      repo,
      branch,
      latestRun,
      activeRun,
      message: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "github_api_error";
    let hint = "GitHub-API nicht erreichbar.";
    if (msg === "github_api_401" || msg === "github_api_403") {
      hint = "GITHUB_DEPLOY_TOKEN ungültig oder ohne Workflow-Rechte.";
    }

    return {
      configured: true,
      reachable: false,
      repo,
      branch,
      latestRun: null,
      activeRun: null,
      message: hint,
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
    const active = await fetchGithubDeployWorkflowStatus();
    if (active.activeRun) {
      return {
        ok: false,
        error: "Ein Deploy läuft bereits (GitHub Actions).",
      };
    }

    await githubFetchJson(
      `/repos/${repo}/actions/workflows/${DEPLOY_WORKFLOW_FILE}/dispatches`,
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
        error: `Workflow ${DEPLOY_WORKFLOW_FILE} im Repo ${repo} nicht gefunden.`,
      };
    }
    return { ok: false, error: "GitHub-Deploy konnte nicht gestartet werden." };
  }
}

export async function fetchGithubMainCommitSha(): Promise<{
  sha: string | null;
  shortSha: string | null;
  message: string | null;
  reachable: boolean;
}> {
  const repo = githubRepoSlug();
  const branch = githubDeployBranch();

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
        reachable: false,
      };
    }

    const body = (await res.json()) as { sha?: string; commit?: { message?: string } };
    const sha = body.sha?.trim() || null;
    return {
      sha,
      shortSha: sha ? sha.slice(0, 7) : null,
      message: body.commit?.message?.split("\n")[0]?.trim() || null,
      reachable: true,
    };
  } catch {
    return {
      sha: null,
      shortSha: null,
      message: "GitHub-Commit nicht erreichbar.",
      reachable: false,
    };
  }
}
