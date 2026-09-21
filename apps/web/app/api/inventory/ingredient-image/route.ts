import { NextResponse } from "next/server";
import { authorizeRestaurantModule } from "@/lib/permissions/authorize-restaurant-module";
import { processIngredientImageUpload } from "@/lib/images/process-ingredient-image";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { prepareDeclaredUploadBytes } from "@/lib/uploads/sniff-upload-bytes";

export const dynamic = "force-dynamic";

const BUCKET = "inventory-ingredient-images";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const restaurantId = String(form?.get("restaurantId") ?? "").trim();
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeRestaurantModule(restaurantId, "inventory.manage");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!ALLOWED.has(file.type) || file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "invalid_file" }, { status: 400 });
  }

  const sniffed = prepareDeclaredUploadBytes(
    new Uint8Array(await file.arrayBuffer()),
    file.type,
  );
  if (!sniffed) {
    return NextResponse.json({ error: "invalid_file" }, { status: 400 });
  }

  let processed: Buffer;
  try {
    processed = await processIngredientImageUpload(Buffer.from(sniffed));
  } catch {
    return NextResponse.json({ error: "invalid_file" }, { status: 400 });
  }
  if (!processed.byteLength) {
    return NextResponse.json({ error: "invalid_file" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const path = `${restaurantId}/${crypto.randomUUID()}.webp`;
  const { error } = await admin.storage.from(BUCKET).upload(path, processed, {
    contentType: "image/webp",
    upsert: false,
  });
  if (error) {
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }

  return NextResponse.json({ path });
}
