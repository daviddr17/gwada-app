import { authorizeStaffRestaurant } from "@/lib/staff/route-auth";
import { staffAvatarStoragePath } from "@/lib/supabase/staff-db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const restaurantId = String(form.get("restaurantId") ?? "").trim();
  const staffId = String(form.get("staffId") ?? "").trim();
  const file = form.get("file");

  if (
    !isUuidRestaurantId(restaurantId) ||
    !isUuidRestaurantId(staffId) ||
    !(file instanceof File)
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!ALLOWED.has(file.type) || file.size > MAX_BYTES) {
    return Response.json({ error: "invalid_file" }, { status: 400 });
  }

  const auth = await authorizeStaffRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";

  const path = staffAvatarStoragePath({ restaurantId, staffId, ext });
  const userSb = await createSupabaseServerClient();
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await userSb.storage
    .from("restaurant-staff-avatars")
    .upload(path, buf, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const { error: updateError } = await userSb
    .from("restaurant_staff")
    .update({ avatar_storage_path: path })
    .eq("id", staffId)
    .eq("restaurant_id", restaurantId);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ ok: true, path });
}
