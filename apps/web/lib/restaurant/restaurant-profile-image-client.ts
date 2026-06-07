import type { RestaurantProfileImageKind } from "@/lib/restaurant/restaurant-profile-image";

export async function uploadRestaurantProfileImageClient(params: {
  restaurantId: string;
  kind: RestaurantProfileImageKind;
  file: File;
}): Promise<{ path?: string; kind?: RestaurantProfileImageKind; error?: string }> {
  const form = new FormData();
  form.set("restaurantId", params.restaurantId);
  form.set("kind", params.kind);
  form.set("file", params.file);

  const res = await fetch("/api/restaurant/profile-image", {
    method: "POST",
    body: form,
  });

  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    path?: string;
    kind?: RestaurantProfileImageKind;
    error?: string;
  };

  if (!res.ok) {
    return { error: body.error ?? `profile_image_${res.status}` };
  }

  return { path: body.path, kind: body.kind };
}
