import "server-only";

import {
  githubDeployBranch,
  githubFetchJson,
  githubRepoSlug,
  resolveGithubDeployAccessToken,
  shouldFallbackGithubWorkflowDispatch,
} from "@/lib/superadmin/github-deploy-api-server";

export const WAHA_HOST_REBOOT_WORKFLOW_FILE = "reboot-waha-host-live.yml";
export const WAHA_HOST_REBOOT_REPOSITORY_DISPATCH_TYPE = "reboot-waha-host-live";

/** Soft-Reboot nur dieses WAHA-Hosts (per-server SSH). */
export async function triggerWahaHostReboot(input: {
  serverId: string;
  serverName?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const serverId = input.serverId.trim();
  if (!serverId) {
    return { ok: false, error: "server_id_missing" };
  }

  const token = await resolveGithubDeployAccessToken({ strict: true });
  if (!token) {
    return { ok: false, error: "github_deploy_token_missing" };
  }

  const repo = githubRepoSlug();
  const ref = githubDeployBranch();
  const payload = {
    ref,
    server_id: serverId,
    server_name: input.serverName ?? "",
    confirm: "REBOOT",
  };

  try {
    try {
      await githubFetchJson(
        `/repos/${repo}/actions/workflows/${WAHA_HOST_REBOOT_WORKFLOW_FILE}/dispatches`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ref,
            inputs: {
              server_id: serverId,
              confirm: "REBOOT",
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
      const msg = e instanceof Error ? e.message : undefined;
      if (!shouldFallbackGithubWorkflowDispatch(status, msg)) throw e;
    }

    await githubFetchJson(
      `/repos/${repo}/dispatches`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: WAHA_HOST_REBOOT_REPOSITORY_DISPATCH_TYPE,
          client_payload: payload,
        }),
      },
      token,
    );
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "dispatch_failed";
    console.warn("[waha] host reboot dispatch", message);
    return { ok: false, error: message };
  }
}
