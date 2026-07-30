import "server-only";

import {
  githubDeployBranch,
  githubFetchJson,
  githubRepoSlug,
  resolveGithubDeployAccessToken,
  shouldFallbackGithubWorkflowDispatch,
} from "@/lib/superadmin/github-deploy-api-server";

export const LIVE_VPS_REBOOT_WORKFLOW_FILE = "reboot-live-vps.yml";
export const LIVE_VPS_REBOOT_REPOSITORY_DISPATCH_TYPE = "reboot-live-vps";

/** Mindestens Abstand zwischen VPS-Reboots (Schutz vor Doppelklick / Loop). */
export const LIVE_VPS_REBOOT_COOLDOWN_MS = 30 * 60 * 1000;

type WorkflowRunLite = {
  id?: number;
  status?: string | null;
  created_at?: string | null;
  html_url?: string | null;
};

async function latestRebootWorkflowRun(): Promise<WorkflowRunLite | null> {
  const token = await resolveGithubDeployAccessToken({ strict: true });
  if (!token) return null;
  const repo = githubRepoSlug();
  try {
    const body = (await githubFetchJson(
      `/repos/${repo}/actions/workflows/${LIVE_VPS_REBOOT_WORKFLOW_FILE}/runs?per_page=1`,
      undefined,
      token,
    )) as { workflow_runs?: WorkflowRunLite[] };
    return body.workflow_runs?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function getLiveVpsRebootCooldownRemainingMs(): Promise<number> {
  const latest = await latestRebootWorkflowRun();
  if (!latest?.created_at) return 0;
  const created = Date.parse(latest.created_at);
  if (!Number.isFinite(created)) return 0;
  const elapsed = Date.now() - created;
  if (elapsed >= LIVE_VPS_REBOOT_COOLDOWN_MS) return 0;
  return LIVE_VPS_REBOOT_COOLDOWN_MS - elapsed;
}

/**
 * Soft-Reboot des Live-VPS (Contabo) via GitHub Action → SSH.
 * Betrifft die ganze Live-Umgebung (App, DB-Proxy, WAHA auf dem Host), nicht nur eine Session.
 */
export async function triggerLiveVpsReboot(input?: {
  reason?: string;
}): Promise<{ ok: boolean; error?: string; htmlUrl?: string | null }> {
  const token = await resolveGithubDeployAccessToken({ strict: true });
  if (!token) {
    return { ok: false, error: "github_deploy_token_missing" };
  }

  const cooldownMs = await getLiveVpsRebootCooldownRemainingMs();
  if (cooldownMs > 0) {
    const mins = Math.ceil(cooldownMs / 60_000);
    return {
      ok: false,
      error: `reboot_cooldown_${mins}m`,
    };
  }

  const repo = githubRepoSlug();
  const ref = githubDeployBranch();
  const reason = (input?.reason ?? "superadmin")
    .replace(/[^\w ./-]+/g, "")
    .slice(0, 120);

  try {
    try {
      await githubFetchJson(
        `/repos/${repo}/actions/workflows/${LIVE_VPS_REBOOT_WORKFLOW_FILE}/dispatches`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ref,
            inputs: { reason },
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
      const msg = e instanceof Error ? e.message : undefined;
      if (!shouldFallbackGithubWorkflowDispatch(status, msg)) throw e;
    }

    await githubFetchJson(
      `/repos/${repo}/dispatches`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: LIVE_VPS_REBOOT_REPOSITORY_DISPATCH_TYPE,
          client_payload: { ref, reason },
        }),
      },
      token,
    );
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "dispatch_failed";
    console.warn("[live-vps] reboot dispatch", message);
    return { ok: false, error: message };
  }
}
