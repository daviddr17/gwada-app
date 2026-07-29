import "server-only";

import {
  githubDeployBranch,
  githubDeployToken,
  githubDeployTokenStrict,
  githubFetchJson,
  githubRepoSlug,
} from "@/lib/superadmin/github-deploy-api-server";

export const WAHA_RESTART_WORKFLOW_FILE = "restart-waha-live.yml";
export const WAHA_RESTART_REPOSITORY_DISPATCH_TYPE = "restart-waha-live";

/**
 * Startet Docker-Restart eines WAHA-Containers auf dem VPS via GitHub Action.
 * SSH-Keys bleiben in GitHub Secrets — nicht in der App.
 */
export async function triggerWahaContainerRestart(input: {
  serverId: string;
  containerName: string;
  serverName?: string;
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

  const repo = githubRepoSlug();
  const ref = githubDeployBranch();
  const payload = {
    ref,
    container: container,
    server_id: input.serverId,
    server_name: input.serverName ?? "",
  };

  try {
    try {
      await githubFetchJson(
        `/repos/${repo}/actions/workflows/${WAHA_RESTART_WORKFLOW_FILE}/dispatches`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ref,
            inputs: {
              container,
              server_id: input.serverId,
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
          event_type: WAHA_RESTART_REPOSITORY_DISPATCH_TYPE,
          client_payload: payload,
        }),
      },
      token,
    );
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "dispatch_failed";
    console.warn("[waha] container restart dispatch", message);
    return { ok: false, error: message };
  }
}
