import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { githubApiErrorHint } from "@/lib/superadmin/github-deploy-api-server";
import { triggerWahaHostReboot } from "@/lib/superadmin/waha-host-reboot-server";
import { getWahaServerByIdAdmin } from "@/lib/supabase/waha-servers-db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Soft-Reboot des WAHA-Hosts (nicht Gwada-Contabo).
 * Body: { confirm: "REBOOT" }
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
  if (!server.ssh_host?.trim() || !server.ssh_private_key?.trim()) {
    return Response.json(
      {
        error: "ssh_not_configured",
        message:
          "SSH-Host und SSH-Key unter Bearbeiten setzen — Host-Reboot gilt nur für diesen WAHA-Server.",
      },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== "REBOOT") {
    return Response.json(
      {
        error: "confirm_required",
        message: 'Bestätigung fehlt — Body muss { "confirm": "REBOOT" } enthalten.',
      },
      { status: 400 },
    );
  }

  const result = await triggerWahaHostReboot({
    serverId: server.id,
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
        error: result.error ?? "reboot_failed",
        message:
          authHint ??
          `Host-Reboot konnte nicht gestartet werden${result.error ? ` (${result.error})` : ""}.`,
      },
      { status: 502 },
    );
  }

  return Response.json({
    ok: true,
    host: server.ssh_host.trim(),
    message: `Host-Reboot für ${server.name} (${server.ssh_host.trim()}) gestartet.`,
  });
}
