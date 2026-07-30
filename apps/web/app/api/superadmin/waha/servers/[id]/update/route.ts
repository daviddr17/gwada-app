import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { githubApiErrorHint } from "@/lib/superadmin/github-deploy-api-server";
import {
  getWahaServerByIdAdmin,
  wahaServerRowToConfig,
} from "@/lib/supabase/waha-servers-db";
import { triggerWahaContainerUpdate } from "@/lib/superadmin/waha-container-update-server";
import {
  buildWahaVersionStatus,
  fetchLatestWahaRelease,
} from "@/lib/waha/waha-version-server";
import { normalizeWahaVersion } from "@/lib/waha/waha-version";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * WAHA Docker-Image updaten (GitHub Action → compose pull + up -d).
 * Body optional: { confirm: "UPDATE", targetVersion?: "2026.7.2" }
 */
export async function POST(req: Request, context: RouteContext) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const server = await getWahaServerByIdAdmin(id);
  if (!server) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (!server.docker_container_name?.trim()) {
    return Response.json(
      {
        error: "docker_container_name_missing",
        message:
          "Docker-Container-Name fehlt. Unter Bearbeiten z. B. „waha“ eintragen.",
      },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    confirm?: string;
    targetVersion?: string;
  };
  if (body.confirm !== "UPDATE") {
    return Response.json(
      {
        error: "confirm_required",
        message:
          'Bestätigung fehlt — Body muss { "confirm": "UPDATE" } enthalten.',
      },
      { status: 400 },
    );
  }

  let targetVersion =
    normalizeWahaVersion(body.targetVersion) ??
    (await fetchLatestWahaRelease())?.version ??
    null;

  const config = wahaServerRowToConfig(server);
  if (config && !body.targetVersion) {
    const status = await buildWahaVersionStatus({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    });
    targetVersion = status.latest?.version ?? targetVersion;
  }

  const result = await triggerWahaContainerUpdate({
    serverId: server.id,
    containerName: server.docker_container_name.trim(),
    serverName: server.name,
    targetVersion,
  });

  if (!result.ok) {
    const cooldown = result.error?.startsWith("update_cooldown_");
    const authHint =
      result.error === "github_deploy_token_missing" ||
      result.error === "github_api_401" ||
      result.error === "github_api_403"
        ? githubApiErrorHint(result.error)
        : null;
    return Response.json(
      {
        error: result.error ?? "update_failed",
        message: cooldown
          ? `WAHA-Update erst wieder in ${result.error?.replace("update_cooldown_", "")} möglich.`
          : (authHint ??
            `WAHA-Update konnte nicht gestartet werden${result.error ? ` (${result.error})` : ""}.`),
      },
      { status: cooldown ? 429 : 502 },
    );
  }

  return Response.json({
    ok: true,
    container: server.docker_container_name.trim(),
    targetVersion,
    message:
      "WAHA-Update gestartet. Compose/.env werden vor dem Edit gesichert; pull + up -d. WhatsApp kurz offline — Sessions nur bei persistentem Storage sicher.",
  });
}
