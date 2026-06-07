export async function uploadRestaurantDocumentClient(params: {
  restaurantId: string;
  file: File;
  title?: string;
  tagId?: string | null;
}): Promise<{ documentId?: string; error?: string }> {
  const form = new FormData();
  form.set("restaurantId", params.restaurantId);
  form.set("file", params.file);
  if (params.title?.trim()) form.set("title", params.title.trim());
  if (params.tagId) form.set("tagId", params.tagId);

  const res = await fetch("/api/documents/upload", {
    method: "POST",
    body: form,
  });
  const body = (await res.json().catch(() => ({}))) as {
    documentId?: string;
    error?: string;
  };
  if (!res.ok) {
    return { error: body.error ?? `upload_${res.status}` };
  }
  return { documentId: body.documentId };
}

export async function deleteRestaurantDocumentClient(params: {
  restaurantId: string;
  documentId: string;
}): Promise<{ error?: string }> {
  const res = await fetch("/api/documents/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) return { error: body.error ?? `delete_${res.status}` };
  return {};
}

export async function updateRestaurantDocumentClient(params: {
  restaurantId: string;
  documentId: string;
  title?: string;
  tagId?: string | null;
}): Promise<{ error?: string }> {
  const res = await fetch("/api/documents/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) return { error: body.error ?? `update_${res.status}` };
  return {};
}

export async function appendRestaurantDocumentNoteEntryClient(params: {
  restaurantId: string;
  documentId: string;
  body: string;
}): Promise<{ error?: string }> {
  const res = await fetch("/api/documents/note-entry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const parsed = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) return { error: parsed.error ?? `note_entry_${res.status}` };
  return {};
}

export async function updateRestaurantDocumentNoteEntryClient(params: {
  restaurantId: string;
  entryId: string;
  body: string;
}): Promise<{ error?: string }> {
  const res = await fetch("/api/documents/note-entry", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const parsed = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) return { error: parsed.error ?? `note_entry_patch_${res.status}` };
  return {};
}

export function restaurantDocumentDownloadUrl(params: {
  restaurantId: string;
  documentId: string;
}): string {
  const q = new URLSearchParams({
    restaurantId: params.restaurantId,
    documentId: params.documentId,
  });
  return `/api/documents/download?${q.toString()}`;
}
