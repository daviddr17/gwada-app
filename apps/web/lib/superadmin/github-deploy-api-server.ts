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
export const APP_DEPLOY_REPOSITORY_DISPATCH_TYPE = "deploy-live-app";
export const DB_DEPLOY_REPOSITORY_DISPATCH_TYPE = "deploy-live-db";

/** Nur für Superadmin-Deploy — kein Fallback auf Changelog-/Build-Tokens. */
export function githubDeployTokenStrict(): string | null {
  return process.env.GITHUB_DEPLOY_TOKEN?.trim() || null;
}

export function githubDeployToken(): string | null {
  return (
    githubDeployTokenStrict() ||
    process.env.CHANGELOG_GIT_TOKEN?.trim() ||
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
    process.env.CHANGELOG_GIT_BRANCH?.trim() ||
    "main"
  );
}

type GithubFetchResult = {
  body: unknown;
  status: number;
  oauthScopes: string[];
};

async function githubFetch(
  path: string,
  init?: RequestInit,
  token = githubDeployToken(),
): Promise<GithubFetchResult> {
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

  const oauthScopes = (res.headers.get("x-oauth-scopes") ?? "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);

  if (!res.ok) {
    const err = new Error(`github_api_${res.status}`) as Error & {
      status?: number;
      oauthScopes?: string[];
    };
    err.status = res.status;
    err.oauthScopes = oauthScopes;
    throw err;
  }

  const text = await res.text();
  return {
    status: res.status,
    oauthScopes,
    body: text ? (JSON.parse(text) as unknown) : null,
  };
}

export async function githubFetchJson(
  path: string,
  init?: RequestInit,
  token?: string,
): Promise<unknown> {
  const result = await githubFetch(path, init, token);
  return result.body;
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

function githubDispatchErrorMessage(input: {
  status: number | undefined;
  workflowFile: string;
  usedRepositoryDispatch: boolean;
}): string {
  if (input.status === 404) {
    return `Workflow ${input.workflowFile} im Repo ${githubRepoSlug()} nicht gefunden.`;
  }
  if (input.status === 401 || input.status === 403) {
    if (input.usedRepositoryDispatch) {
      return "GITHUB_DEPLOY_TOKEN fehlt Repo-Rechte (repo) — Deploy kann nicht ausgelöst werden.";
    }
    return "GITHUB_DEPLOY_TOKEN kann Workflows nicht starten — PAT mit repo (und idealerweise workflow) in GWADA_GITHUB_DEPLOY_TOKEN setzen, dann sync-github-deploy-token-live.yml ausführen.";
  }
  if (input.status === 422) {
    return "GitHub lehnt den Deploy-Trigger ab (Ref oder Workflow-Konfiguration prüfen).";
  }
  return input.usedRepositoryDispatch
    ? "GitHub-Deploy (repository_dispatch) konnte nicht gestartet werden."
    : "GitHub-Deploy konnte nicht gestartet werden.";
}

async function dispatchGithubDeployEvent(input: {
  workflowFile: string;
  repositoryDispatchType: string;
  ref: string;
  workflowInputs?: Record<string, string>;
  clientPayload?: Record<string, unknown>;
}): Promise<void> {
  const token = githubDeployTokenStrict() ?? githubDeployToken();
  if (!token) throw new Error("github_deploy_token_missing");

  const repo = githubRepoSlug();
  const payload = input.clientPayload ?? { ref: input.ref };

  try {
    await githubFetchJson(
      `/repos/${repo}/actions/workflows/${input.workflowFile}/dispatches`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref: input.ref,
          ...(input.workflowInputs ? { inputs: input.workflowInputs } : {}),
        }),
      },
      token,
    );
    return;
  } catch (e) {
    const status =
      e instanceof Error && "status" in e
        ? (e as Error & { status?: number }).status
        : undefined;
    const msg = e instanceof Error ? e.message : "dispatch_failed";
    if (status !== 403 && msg !== "github_api_403") {
      throw e;
    }
  }

  await githubFetchJson(
    `/repos/${repo}/dispatches`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: input.repositoryDispatchType,
        client_payload: payload,
      }),
    },
    token,
  );
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
        "GITHUB_DEPLOY_TOKEN in der App-Env setzen (repo, workflow oder repo+read:packages).",
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
  const token = githubDeployTokenStrict() ?? githubDeployToken();
  if (!token) {
    return {
      ok: false,
      error:
        "GITHUB_DEPLOY_TOKEN fehlt — Deploy kann nicht ausgelöst werden.",
    };
  }

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

    await dispatchGithubDeployEvent({
      workflowFile: APP_DEPLOY_WORKFLOW_FILE,
      repositoryDispatchType: APP_DEPLOY_REPOSITORY_DISPATCH_TYPE,
      ref: branch,
      workflowInputs: { ref: branch, force_unlock: "true" },
      clientPayload: { ref: branch, force_unlock: "true" },
    });

    return { ok: true };
  } catch (e) {
    const status =
      e instanceof Error && "status" in e
        ? (e as Error & { status?: number }).status
        : undefined;
    const msg = e instanceof Error ? e.message : "dispatch_failed";
    if (msg === "github_api_404") {
      return {
        ok: false,
        error: githubDispatchErrorMessage({
          status: 404,
          workflowFile: APP_DEPLOY_WORKFLOW_FILE,
          usedRepositoryDispatch: false,
        }),
      };
    }
    return {
      ok: false,
      error: githubDispatchErrorMessage({
        status,
        workflowFile: APP_DEPLOY_WORKFLOW_FILE,
        usedRepositoryDispatch: status === 403 || msg === "github_api_403",
      }),
    };
  }
}

export async function dispatchGithubLiveDbDeploy(
  ref?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = githubDeployTokenStrict() ?? githubDeployToken();
  if (!token) {
    return {
      ok: false,
      error:
        "GITHUB_DEPLOY_TOKEN fehlt — Deploy kann nicht ausgelöst werden.",
    };
  }

  const branch = ref?.trim() || githubDeployBranch();

  try {
    const active = await fetchGithubDeployWorkflowStatus({
      workflowFile: DB_DEPLOY_WORKFLOW_FILE,
      label: "DB live",
    });
    if (active.activeRun) {
      return {
        ok: false,
        error: "Ein DB-Deploy läuft bereits (GitHub Actions).",
      };
    }

    await dispatchGithubDeployEvent({
      workflowFile: DB_DEPLOY_WORKFLOW_FILE,
      repositoryDispatchType: DB_DEPLOY_REPOSITORY_DISPATCH_TYPE,
      ref: branch,
      clientPayload: { ref: branch },
    });

    return { ok: true };
  } catch (e) {
    const status =
      e instanceof Error && "status" in e
        ? (e as Error & { status?: number }).status
        : undefined;
    const msg = e instanceof Error ? e.message : "dispatch_failed";
    if (msg === "github_api_404") {
      return {
        ok: false,
        error: githubDispatchErrorMessage({
          status: 404,
          workflowFile: DB_DEPLOY_WORKFLOW_FILE,
          usedRepositoryDispatch: false,
        }),
      };
    }
    return {
      ok: false,
      error: githubDispatchErrorMessage({
        status,
        workflowFile: DB_DEPLOY_WORKFLOW_FILE,
        usedRepositoryDispatch: status === 403 || msg === "github_api_403",
      }),
    };
  }
}

export async function fetchGithubHeadCommit(
  branch = githubDeployBranch(),
): Promise<SuperadminGithubHeadCommit & { reachable: boolean }> {
  const repo = githubRepoSlug();
  const token = githubDeployToken();

  if (!token) {
    return {
      sha: null,
      shortSha: null,
      message: "GITHUB_DEPLOY_TOKEN fehlt für Commit-Abfrage.",
      author: null,
      committedAt: null,
      htmlUrl: null,
      reachable: false,
    };
  }

  try {
    const body = (await githubFetchJson(
      `/repos/${repo}/commits/${encodeURIComponent(branch)}`,
    )) as {
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : "github_failed";
    return {
      sha: null,
      shortSha: null,
      message: githubApiErrorHint(msg),
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
