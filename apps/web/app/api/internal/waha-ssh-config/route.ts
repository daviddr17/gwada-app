import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { getWahaServerByIdAdmin } from "@/lib/supabase/waha-servers-db";
import { normalizeSshPrivateKey } from "@/lib/waha/normalize-ssh-private-key";

export const dynamic = "force-dynamic";

/**
 * GitHub Actions holt SSH-Ziel pro WAHA-Server (Key nicht im Dispatch-Payload).
 * Auth: Bearer CRON_SECRET.
 */
export async function GET(req: Request) {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  const serverId = new URL(req.url).searchParams.get("server_id")?.trim();
  if (!serverId) {
    return Response.json({ error: "server_id_required" }, { status: 400 });
  }

  const server = await getWahaServerByIdAdmin(serverId);
  if (!server) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  const host = server.ssh_host?.trim() || null;
  const key = normalizeSshPrivateKey(server.ssh_private_key ?? "") || null;
  const user = (server.ssh_user?.trim() || "root").slice(0, 64);
  const port =
    typeof server.ssh_port === "number" &&
    server.ssh_port >= 1 &&
    server.ssh_port <= 65535
      ? server.ssh_port
      : 22;
  const containerName = server.docker_container_name?.trim() || null;

  if (host && key) {
    return Response.json({
      ok: true,
      mode: "per_server" as const,
      serverId: server.id,
      serverName: server.name,
      host,
      user,
      port,
      privateKey: key,
      containerName,
    });
  }

  if (host && !key) {
    return Response.json(
      {
        error: "ssh_private_key_missing",
        message:
          "ssh_host gesetzt, aber kein SSH-Key — unter Superadmin → WAHA → Bearbeiten hinterlegen.",
      },
      { status: 422 },
    );
  }

  // Kein eigener Host → Gwada Live-VPS-Secrets in der Action nutzen
  return Response.json({
    ok: true,
    mode: "legacy_live_vps" as const,
    serverId: server.id,
    serverName: server.name,
    host: null,
    user: "root",
    port: 22,
    privateKey: null,
    containerName,
  });
}
