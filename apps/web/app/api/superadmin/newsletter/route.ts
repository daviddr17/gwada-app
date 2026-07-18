import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createPlatformNewsletter,
  duplicatePlatformNewsletter,
  listPlatformNewsletters,
} from "@/lib/supabase/platform-newsletter-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }
  const url = new URL(req.url);
  const templates = url.searchParams.get("templates") === "1";
  try {
    const items = await listPlatformNewsletters(admin, {
      templatesOnly: templates,
    });
    return Response.json({ items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "list_failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  let body: {
    title?: string;
    fromNewsletterId?: string;
    asTemplate?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    if (body.fromNewsletterId) {
      const id = await duplicatePlatformNewsletter(admin, body.fromNewsletterId, {
        asTemplate: Boolean(body.asTemplate),
        createdBy: auth.userId,
        titleSuffix: body.asTemplate ? " (Vorlage)" : " (Kopie)",
      });
      return Response.json({ id });
    }
    const id = await createPlatformNewsletter(admin, {
      title: body.title?.trim() || "Neuer Newsletter",
      isTemplate: Boolean(body.asTemplate),
      createdBy: auth.userId,
      blocks: [{ heading: "", body: "" }],
    });
    return Response.json({ id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "create_failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
