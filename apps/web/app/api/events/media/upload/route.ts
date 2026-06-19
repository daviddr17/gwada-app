import {
  EVENTS_MEDIA_BUCKET,
  buildEventsMediaStoragePath,
} from "@/lib/events/events-media";
import { authorizeEventsRestaurant } from "@/lib/events/route-auth";
import { uploadEventsMedia } from "@/lib/events/events-media-api";
import { validateEventsMediaFile } from "@/lib/events/validate-events-media-file";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const restaurantId = String(form?.get("restaurantId") ?? "").trim();
  const eventId = String(form?.get("eventId") ?? "").trim();
  const file = form?.get("file");

  if (!(file instanceof File) || !eventId) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeEventsRestaurant(restaurantId, { requireManage: true });
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const fileError = validateEventsMediaFile(file);
  if (fileError) {
    return Response.json({ error: "invalid_file" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const storagePath = buildEventsMediaStoragePath({
    restaurantId,
    eventId,
    fileName: file.name,
  });
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(EVENTS_MEDIA_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  return Response.json({ storagePath, mimeType: file.type });
}
