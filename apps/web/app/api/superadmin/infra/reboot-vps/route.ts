import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import {
  getLiveVpsRebootCooldownRemainingMs,
  triggerLiveVpsReboot,
} from "@/lib/superadmin/live-vps-reboot-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const cooldownMs = await getLiveVpsRebootCooldownRemainingMs();
  return Response.json({
    cooldownMs,
    cooldownMinutes: Math.ceil(cooldownMs / 60_000),
  });
}

/** Contabo/Live-VPS Soft-Reboot (SSH via GitHub Action). */
export async function POST(req: Request) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    confirm?: string;
    reason?: string;
  };

  if (body.confirm !== "REBOOT") {
    return Response.json(
      {
        error: "confirm_required",
        message: "Bestätigung fehlt — Body muss { \"confirm\": \"REBOOT\" } enthalten.",
      },
      { status: 400 },
    );
  }

  const result = await triggerLiveVpsReboot({
    reason: body.reason?.trim() || "superadmin-waha",
  });

  if (!result.ok) {
    const cooldown = result.error?.startsWith("reboot_cooldown_");
    return Response.json(
      {
        error: result.error ?? "reboot_failed",
        message: cooldown
          ? `VPS-Reboot erst wieder in ${result.error?.replace("reboot_cooldown_", "")} möglich.`
          : result.error === "github_deploy_token_missing"
            ? "GitHub-Auth fehlt — VPS-Reboot nicht möglich (GitHub App oder GITHUB_DEPLOY_TOKEN)."
            : "VPS-Reboot konnte nicht gestartet werden.",
      },
      { status: cooldown ? 429 : 502 },
    );
  }

  return Response.json({
    ok: true,
    message:
      "VPS-Reboot gestartet. Live (App, DB-Proxy, WAHA) ist kurz offline — meist 1–3 Minuten.",
  });
}
