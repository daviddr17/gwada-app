import "server-only";

import {
  githubDeployBranch,
  githubDeployToken,
  githubDeployTokenStrict,
  githubFetchJson,
  githubRepoSlug,
} from "@/lib/superadmin/github-deploy-api-server";
import { normalizeWahaVersion } from "@/lib/waha/waha-version";

export const WAHA_UPDATE_WORKFLOW_FILE = "update-waha-live.yml";
export const WAHA_UPDATE_REPOSITORY_DISPATCH_TYPE = "update-waha-live";

/** Cooldown zwischen Image-Updates desselben Containers (GitHub-Run). */
export const WAHA_UPDATE_COOLDOWN_MS = 20 * 60 * 1000;

type WorkflowRunLite = {
  id?: number;
  status?: string | null;
  created_at?: string | null;
};

async function latestUpdateWorkflowRun(): Promise<WorkflowRunLite | null> {
  const token = githubDeployTokenStrict() ?? githubDeployToken();
  if (!token) return null;
  const repo = githubRepoSlug();
  try {
    const body = (await githubFetchJson(
      `/repos/${repo}/actions/workflows/${WAHA_UPDATE_WORKFLOW_FILE}/runs?per_page=1`,
      undefined,
      token,
    )) as { workflow_runs?: WorkflowRunLite[] };
    return body.workflow_runs?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function getWahaUpdateCooldownRemainingMs(): Promise<number> {
  const latest = await latestUpdateWorkflowRun();
  if (!latest?.created_at) return 0;
  const created = Date.parse(latest.created_at);
  if (!Number.isFinite(created)) return 0;
  const elapsed = Date.now() - created;
  if (elapsed >= WAHA_UPDATE_COOLDOWN_MS) return 0;
  return WAHA_UPDATE_COOLDOWN_MS - elapsed;
}

/**
 * WAHA-Image auf dem VPS aktualisieren (GitHub Action → SSH).
 * Entspricht der offiziellen Doku: compose pull + up -d; pinned Tags → latest-YYYY.M.B.
 */
export async function triggerWahaContainerUpdate(input: {
  serverId: string;
  containerName: string;
  serverName?: string;
  /** Zielversion z. B. 2026.7.2 — wird zu Docker-Tag latest-{version} für pinned Images. */
  targetVersion?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const container = input.containerName.trim();
  if (!container) {
    return { ok: false, error: "docker_container_name_missing" };
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(container)) {
    return { ok: false, error: "docker_container_name_invalid" };
  }

  const token = githubDeployTokenStrict() ?? githubDeployToken();
  if (!token) {
    return { ok: false, error: "github_deploy_token_missing" };
  }

  const cooldownMs = await getWahaUpdateCooldownRemainingMs();
  if (cooldownMs > 0) {
    const mins = Math.ceil(cooldownMs / 60_000);
    return { ok: false, error: `update_cooldown_${mins}m` };
  }

  const targetVersion = normalizeWahaVersion(input.targetVersion) ?? "";
  const repo = githubRepoSlug();
  const ref = githubDeployBranch();
  const payload = {
    ref,
    container,
    server_id: input.serverId,
    server_name: input.serverName ?? "",
    target_version: targetVersion,
  };

  try {
    try {
      await githubFetchJson(
        `/repos/${repo}/actions/workflows/${WAHA_UPDATE_WORKFLOW_FILE}/dispatches`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ref,
            inputs: {
              container,
              server_id: input.serverId,
              target_version: targetVersion,
            },
          }),
        },
        token,
      );
      return { ok: true };
    } catch (e) {
      const status =
        e instanceof Error && "status" in e
          ? (e as Error & { status?: number }).status
          : undefined;
      if (status !== 403) throw e;
    }

    await githubFetchJson(
      `/repos/${repo}/dispatches`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: WAHA_UPDATE_REPOSITORY_DISPATCH_TYPE,
          client_payload: payload,
        }),
      },
      token,
    );
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "dispatch_failed";
    console.warn("[waha] container update dispatch", message);
    return { ok: false, error: message };
  }
}
