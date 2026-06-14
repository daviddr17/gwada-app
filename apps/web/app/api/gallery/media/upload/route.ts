import { randomUUID } from "crypto";
import {
  GALLERY_MEDIA_BUCKET,
  buildGalleryMediaStoragePath,
  resolveGalleryMediaSignedUrl,
} from "@/lib/gallery/gallery-media";
import { authorizeGalleryRestaurant } from "@/lib/gallery/route-auth";
import {
  galleryMediaKindFromMime,
  validateGalleryMediaFile,
} from "@/lib/gallery/validate-gallery-media-file";
import { assertWorkspaceStorageAvailable } from "@/lib/gallery/workspace-storage-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const restaurantId = String(form?.get("restaurantId") ?? "").trim();
  const itemId = String(form?.get("itemId") ?? "").trim();
  const file = form?.get("file");

  if (!(file instanceof File) || !itemId) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeGalleryRestaurant(restaurantId, {
    permission: "gallery.create",
  });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const fileError = validateGalleryMediaFile(file);
  if (fileError) {
    return Response.json({ error: "invalid_file" }, { status: 400 });
  }

  const quota = await assertWorkspaceStorageAvailable(auth.sb, restaurantId, file.size);
  if (!quota.ok) {
    return Response.json({ error: quota.error }, { status: quota.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const storagePath = buildGalleryMediaStoragePath({
    restaurantId,
    itemId,
    fileName: file.name,
  });
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(GALLERY_MEDIA_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const signedUrl = await resolveGalleryMediaSignedUrl(storagePath);

  return Response.json({
    itemId,
    storagePath,
    mimeType: file.type,
    kind: galleryMediaKindFromMime(file.type),
    sizeBytes: file.size,
    previewUrl: signedUrl,
  });
}
