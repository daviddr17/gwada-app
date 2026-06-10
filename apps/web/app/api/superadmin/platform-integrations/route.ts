import { mergePlatformIntegrationConfig } from "@/lib/superadmin/merge-platform-integration-config";
import { platformIntegrationConfigForUi } from "@/lib/superadmin/platform-integration-ui-config";
import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PlatformIntegrationKey } from "@/lib/types/platform-integration";

export const dynamic = "force-dynamic";

const KEYS = new Set<string>([
  "google_oauth",
  "apple_oauth",
  "facebook",
  "instagram",
  "google_business",
  "whatsapp",
  "email",
  "weather",
  "fiskaly",
  "lexoffice",
]);

function isKey(k: string): k is PlatformIntegrationKey {
  return KEYS.has(k);
}

export async function GET() {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { data, error } = await admin
    .from("platform_integrations")
    .select("key, enabled, config, updated_at")
    .order("key");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []).map((r) => ({
    key: r.key as PlatformIntegrationKey,
    enabled: Boolean(r.enabled),
    config: platformIntegrationConfigForUi(
      r.key as PlatformIntegrationKey,
      r.config,
    ),
    updated_at: r.updated_at as string,
  }));

  return Response.json({ rows });
}

export async function POST(req: Request) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    key?: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
  };

  const key = body.key?.trim() ?? "";
  if (!isKey(key)) {
    return Response.json({ error: "invalid_key" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { data: existing } = await admin
    .from("platform_integrations")
    .select("config")
    .eq("key", key)
    .maybeSingle();

  const merged = mergePlatformIntegrationConfig(
    key,
    existing?.config,
    body.config ?? {},
  );

  const { error } = await admin.from("platform_integrations").upsert({
    key,
    enabled: body.enabled === true,
    config: merged,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    config: platformIntegrationConfigForUi(key, merged),
  });
}
