import { assertRestaurantStaffApi } from "@/lib/documents/assert-restaurant-staff-api";
import {
  legacyRestaurantProfileImagePaths,
  processRestaurantProfileImageUpload,
  RESTAURANT_PROFILE_IMAGE_OUTPUT_EXT,
  RESTAURANT_PROFILE_IMAGE_OUTPUT_MIME,
} from "@/lib/images/process-restaurant-profile-image";
import {
  RESTAURANT_PROFILE_IMAGES_BUCKET,
  restaurantProfileImageStoragePath,
  type RestaurantProfileImageKind,
} from "@/lib/restaurant/restaurant-profile-image";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function parseKind(raw: string): RestaurantProfileImageKind | null {
  if (raw === "avatar" || raw === "cover") return raw;
  return null;
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const restaurantId = String(form.get("restaurantId") ?? "").trim();
  const kind = parseKind(String(form.get("kind") ?? "").trim());
  const file = form.get("file");

  if (!isUuidRestaurantId(restaurantId) || !kind || !(file instanceof File)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!ALLOWED.has(file.type) || file.size > MAX_BYTES) {
    return Response.json({ error: "invalid_file" }, { status: 400 });
  }

  const auth = await assertRestaurantStaffApi(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const path = restaurantProfileImageStoragePath({
    restaurantId,
    kind,
    ext: RESTAURANT_PROFILE_IMAGE_OUTPUT_EXT,
  });
  const userSb = await createSupabaseServerClient();

  let processed: Buffer;
  try {
    processed = await processRestaurantProfileImageUpload(
      Buffer.from(await file.arrayBuffer()),
      kind,
    );
  } catch {
    return Response.json({ error: "invalid_file" }, { status: 400 });
  }

  if (!processed.byteLength) {
    return Response.json({ error: "invalid_file" }, { status: 400 });
  }

  const { error: uploadError } = await userSb.storage
    .from(RESTAURANT_PROFILE_IMAGES_BUCKET)
    .upload(path, processed, {
      contentType: RESTAURANT_PROFILE_IMAGE_OUTPUT_MIME,
      upsert: true,
    });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  await userSb.storage
    .from(RESTAURANT_PROFILE_IMAGES_BUCKET)
    .remove(legacyRestaurantProfileImagePaths(restaurantId, kind));

  const column =
    kind === "avatar" ? "avatar_storage_path" : "cover_storage_path";

  const { error: updateError } = await userSb
    .from("restaurants")
    .update({ [column]: path })
    .eq("id", restaurantId);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ ok: true, path, kind });
}
