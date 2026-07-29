import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { githubApiErrorHint } from "@/lib/superadmin/github-deploy-api-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWahaServerByIdAdmin } from "@/lib/supabase/waha-servers-db";
import { triggerWahaContainerRestart } from "@/lib/superadmin/waha-container-restart-server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Docker-Container auf dem VPS neu starten (GitHub Action → SSH). */
export async function POST(_req: Request, context: RouteContext) {
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

  const result = await triggerWahaContainerRestart({
    serverId: server.id,
    containerName: server.docker_container_name.trim(),
    serverName: server.name,
  });

  if (!result.ok) {
    const authHint =
      result.error === "github_deploy_token_missing" ||
      result.error === "github_api_401" ||
      result.error === "github_api_403"
        ? githubApiErrorHint(result.error)
        : null;
    return Response.json(
      {
        error: result.error ?? "restart_failed",
        message:
          authHint ??
          `Container-Restart konnte nicht gestartet werden${result.error ? ` (${result.error})` : ""}.`,
      },
      { status: 502 },
    );
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    await admin
      .from("waha_servers")
      .update({ last_container_restart_at: new Date().toISOString() })
      .eq("id", server.id);
  }

  return Response.json({
    ok: true,
    container: server.docker_container_name.trim(),
    message: "Container-Neustart gestartet (GitHub Action).",
  });
}
