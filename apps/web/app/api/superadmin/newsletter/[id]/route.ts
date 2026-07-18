import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  deletePlatformNewsletter,
  getPlatformNewsletterDetail,
  updatePlatformNewsletter,
  type NewsletterBlockInput,
} from "@/lib/supabase/platform-newsletter-db";
import { getPublicSupabaseUrl } from "@/lib/public-env";
import type { PlatformNewsletterStatus } from "@/lib/types/platform-newsletter";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }
  const { id } = await ctx.params;
  try {
    const item = await getPlatformNewsletterDetail(
      admin,
      id,
      getPublicSupabaseUrl(),
    );
    if (!item) return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json({ item });
  } catch (e) {
    const message = e instanceof Error ? e.message : "load_failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }
  const { id } = await ctx.params;
  let body: {
    title?: string;
    subject?: string;
    preheader?: string | null;
    status?: PlatformNewsletterStatus;
    scheduledAt?: string | null;
    isTemplate?: boolean;
    blocks?: NewsletterBlockInput[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    await updatePlatformNewsletter(admin, id, body);
    return Response.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "save_failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }
  const { id } = await ctx.params;
  try {
    await deletePlatformNewsletter(admin, id);
    return Response.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "delete_failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
