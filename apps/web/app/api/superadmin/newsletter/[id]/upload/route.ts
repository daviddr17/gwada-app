import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { PLATFORM_NEWSLETTER_STORAGE_BUCKET } from "@/lib/newsletter/newsletter-constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicSupabaseUrl } from "@/lib/public-env";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request, ctx: Ctx) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }
  const supabaseUrl = getPublicSupabaseUrl();
  if (!supabaseUrl) {
    return Response.json({ error: "supabase_url_missing" }, { status: 503 });
  }

  const { id } = await ctx.params;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file_required" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return Response.json({ error: "invalid_type" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "file_too_large" }, { status: 400 });
  }

  const ext =
    file.type === "image/png" ? "png"
    : file.type === "image/webp" ? "webp"
    : "jpg";
  const path = `${id}/${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage
    .from(PLATFORM_NEWSLETTER_STORAGE_BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const url = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${PLATFORM_NEWSLETTER_STORAGE_BUCKET}/${path}`;
  return Response.json({ path, url });
}
