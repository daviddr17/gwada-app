import { randomUUID } from "crypto";
import {
  NEWS_MEDIA_BUCKET,
  buildNewsMediaStoragePath,
  type NewsMediaRow,
} from "@/lib/news/news-media";
import { authorizeNewsRestaurant } from "@/lib/news/route-auth";
import {
  newsMediaKindFromMime,
  validateNewsMediaFile,
} from "@/lib/news/validate-news-media-file";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const restaurantId = String(form?.get("restaurantId") ?? "").trim();
  const postId = String(form?.get("postId") ?? "").trim();
  const file = form?.get("file");
  const sortOrderRaw = form?.get("sortOrder");

  if (!(file instanceof File) || !postId) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeNewsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const fileError = validateNewsMediaFile(file);
  if (fileError) {
    return Response.json({ error: "invalid_file" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const mediaId = randomUUID();
  const storagePath = buildNewsMediaStoragePath({
    restaurantId,
    postId,
    fileName: file.name,
  });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sortOrder =
    typeof sortOrderRaw === "string" && sortOrderRaw.trim()
      ? Number.parseInt(sortOrderRaw, 10)
      : 0;

  const { error: uploadError } = await admin.storage
    .from(NEWS_MEDIA_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const media: NewsMediaRow = {
    id: mediaId,
    kind: newsMediaKindFromMime(file.type),
    storagePath,
    mimeType: file.type,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
  };

  return Response.json({ media });
}
