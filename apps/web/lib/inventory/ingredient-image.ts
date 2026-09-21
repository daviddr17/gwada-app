"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  getPublicSupabaseUrl,
  isPublicSupabaseProxyEnabled,
} from "@/lib/public-env";

export const INGREDIENT_IMAGE_BUCKET = "inventory-ingredient-images";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function extensionForMime(mime: string): string | null {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}

/** Öffentliche Thumbnail-URL. Pfad bleibt in der DB, nicht die volle URL. */
export function ingredientImagePublicUrl(
  storagePath: string | null | undefined,
): string | null {
  const path = storagePath?.trim();
  if (!path || path.includes("..")) return null;
  const encoded = path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const objectPath = `/storage/v1/object/public/${INGREDIENT_IMAGE_BUCKET}/${encoded}`;
  if (isPublicSupabaseProxyEnabled()) return `/sb${objectPath}`;
  const direct = getPublicSupabaseUrl();
  if (direct) return `${direct.replace(/\/+$/, "")}${objectPath}`;
  return `/sb${objectPath}`;
}

export async function uploadIngredientImage(
  restaurantId: string,
  file: File,
): Promise<{ path: string } | { error: string }> {
  if (!ALLOWED_MIME.has(file.type)) {
    return { error: "Nur JPG, PNG oder WebP." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Bild ist größer als 5 MB." };
  }
  const ext = extensionForMime(file.type);
  if (!ext) return { error: "Nur JPG, PNG oder WebP." };

  const path = `${restaurantId}/${crypto.randomUUID()}.${ext}`;
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage
    .from(INGREDIENT_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: error.message };
  return { path };
}
