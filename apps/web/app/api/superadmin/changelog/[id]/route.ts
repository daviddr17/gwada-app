import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  deletePlatformChangelogEntry,
  updatePlatformChangelogEntry,
} from "@/lib/supabase/platform-changelog-db";
import type {
  PlatformChangelogAudience,
  PlatformChangelogEntryInput,
} from "@/lib/types/platform-changelog";

export const dynamic = "force-dynamic";

function parseAudience(value: unknown): PlatformChangelogAudience | null {
  if (value === "customers" || value === "superadmin") return value;
  return null;
}

function parseInput(body: unknown): PlatformChangelogEntryInput | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title : "";
  const bodyText = typeof o.body === "string" ? o.body : "";
  const publishedAt =
    typeof o.publishedAt === "string" ? o.publishedAt.trim() : "";
  const version =
    o.version === null || o.version === undefined
      ? null
      : typeof o.version === "string"
        ? o.version
        : null;
  const audience = parseAudience(o.audience) ?? "customers";

  if (!title.trim() || !publishedAt) return null;
  const d = new Date(publishedAt);
  if (Number.isNaN(d.getTime())) return null;

  return {
    title,
    body: bodyText,
    publishedAt: d.toISOString(),
    version,
    audience,
  };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return Response.json({ error: "invalid_id" }, { status: 400 });
  }

  const input = parseInput(await req.json().catch(() => null));
  if (!input) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { entry, error } = await updatePlatformChangelogEntry(
    admin,
    id,
    input,
  );
  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ entry });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return Response.json({ error: "invalid_id" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { error } = await deletePlatformChangelogEntry(admin, id);
  if (error) {
    return Response.json({ error }, { status: 500 });
  }

  return Response.json({ ok: true });
}
