"use client";

export async function uploadEventsMedia(params: {
  restaurantId: string;
  eventId: string;
  file: File;
}): Promise<{ storagePath: string; mimeType: string } | { error: string }> {
  const form = new FormData();
  form.append("restaurantId", params.restaurantId);
  form.append("eventId", params.eventId);
  form.append("file", params.file);
  const res = await fetch("/api/events/media/upload", { method: "POST", body: form });
  const data = (await res.json()) as {
    storagePath?: string;
    mimeType?: string;
    error?: string;
  };
  if (!res.ok || !data.storagePath) {
    return { error: data.error ?? "upload_failed" };
  }
  return { storagePath: data.storagePath, mimeType: data.mimeType ?? params.file.type };
}
