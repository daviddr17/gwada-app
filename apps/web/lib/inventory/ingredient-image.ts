"use client";

import {
  getPublicSupabaseUrl,
  isPublicSupabaseProxyEnabled,
} from "@/lib/public-env";

export const INGREDIENT_IMAGE_BUCKET = "inventory-ingredient-images";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

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

  const form = new FormData();
  form.set("restaurantId", restaurantId);
  form.set("file", file);
  const res = await fetch("/api/inventory/ingredient-image", {
    method: "POST",
    body: form,
  });
  const body = (await res.json().catch(() => null)) as { path?: string; error?: string } | null;
  if (!res.ok || !body?.path) {
    if (res.status === 400) return { error: "Nur JPG, PNG oder WebP." };
    if (res.status === 401 || res.status === 403) {
      return { error: "Keine Berechtigung für den Bestand." };
    }
    return { error: "Bild konnte nicht gespeichert werden." };
  }
  return { path: body.path };
}
