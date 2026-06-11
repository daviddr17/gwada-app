import type { NewsMediaRow } from "@/lib/news/news-media";

export async function uploadNewsMedia(params: {
  restaurantId: string;
  postId: string;
  file: File;
  sortOrder?: number;
}): Promise<{ media: NewsMediaRow } | { error: string }> {
  const form = new FormData();
  form.set("restaurantId", params.restaurantId);
  form.set("postId", params.postId);
  form.set("file", params.file);
  if (params.sortOrder != null) {
    form.set("sortOrder", String(params.sortOrder));
  }

  const res = await fetch("/api/news/media/upload", {
    method: "POST",
    body: form,
  });
  const data = (await res.json()) as { media?: NewsMediaRow; error?: string };
  if (!res.ok || !data.media) {
    return { error: data.error ?? "upload_failed" };
  }
  return { media: data.media };
}
