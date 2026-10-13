import { randomUUID } from "crypto";
import { GUIDES_MEDIA_BUCKET } from "@/lib/constants/guides-media";
import {
  buildGuidesMediaStoragePath,
  resolveGuidesMediaSignedUrl,
} from "@/lib/guides/guides-media";
import {
  guidesMediaKindFromMime,
  validateGuidesMediaFile,
} from "@/lib/guides/validate-guides-media-file";
import { assertWorkspaceStorageAvailable } from "@/lib/gallery/workspace-storage-server";
import { authorizeModuleCrud } from "@/lib/permissions/authorize-restaurant-module";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { prepareDeclaredUploadBytes } from "@/lib/uploads/sniff-upload-bytes";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const restaurantId = String(form?.get("restaurantId") ?? "").trim();
  const guideId = String(form?.get("guideId") ?? "").trim();
  const stepIdRaw = String(form?.get("stepId") ?? "").trim();
  const file = form?.get("file");

  if (!(file instanceof File) || !restaurantId || !guideId) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeModuleCrud(restaurantId, "guides", "update");
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const fileError = validateGuidesMediaFile(file);
  if (fileError) {
    return Response.json({ error: fileError }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const { data: guide, error: guideError } = await admin
    .from("restaurant_guides")
    .select("id")
    .eq("id", guideId)
    .eq("restaurant_id", restaurantId)
    .is("archived_at", null)
    .maybeSingle();

  if (guideError || !guide) {
    return Response.json({ error: "guide_not_found" }, { status: 404 });
  }

  const stepId = stepIdRaw || randomUUID();
  const rawBytes = new Uint8Array(await file.arrayBuffer());
  const bytes = prepareDeclaredUploadBytes(rawBytes, file.type);
  if (!bytes) {
    return Response.json({ error: "invalid_file" }, { status: 400 });
  }

  const quota = await assertWorkspaceStorageAvailable(
    auth.sb,
    restaurantId,
    bytes.byteLength,
  );
  if (!quota.ok) {
    return Response.json({ error: quota.error }, { status: quota.status });
  }

  const storagePath = buildGuidesMediaStoragePath({
    restaurantId,
    guideId,
    stepId,
    fileName: file.name || "media",
  });

  const upload = await admin.storage
    .from(GUIDES_MEDIA_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (upload.error) {
    return Response.json({ error: upload.error.message }, { status: 500 });
  }

  const kind = guidesMediaKindFromMime(file.type);
  const signedUrl = await resolveGuidesMediaSignedUrl(storagePath);

  return Response.json({
    guideId,
    stepId,
    storagePath,
    mimeType: file.type,
    kind,
    sizeBytes: bytes.byteLength,
    url: signedUrl,
  });
}
