import { restaurantDocumentDownloadUrl } from "@/lib/documents/documents-api";

export type StaffDocumentListItem = {
  id: string;
  restaurant_id: string;
  tag_id: string | null;
  staff_id: string | null;
  title: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export async function fetchStaffDocumentsForRestaurant(params: {
  restaurantId: string;
}): Promise<{ data: StaffDocumentListItem[]; error: string | null }> {
  const q = new URLSearchParams({
    restaurantId: params.restaurantId,
    scope: "restaurant",
  });
  const res = await fetch(`/api/staff/documents?${q.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    documents?: StaffDocumentListItem[];
    error?: string;
  };
  if (!res.ok) {
    return { data: [], error: body.error ?? `fetch_${res.status}` };
  }
  return { data: body.documents ?? [], error: null };
}

export async function fetchStaffDocumentsForEmployee(params: {
  restaurantId: string;
  staffId: string;
}): Promise<{ data: StaffDocumentListItem[]; error: string | null }> {
  const q = new URLSearchParams({
    restaurantId: params.restaurantId,
    staffId: params.staffId,
    scope: "employee",
  });
  const res = await fetch(`/api/staff/documents?${q.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    documents?: StaffDocumentListItem[];
    error?: string;
  };
  if (!res.ok) {
    return { data: [], error: body.error ?? `fetch_${res.status}` };
  }
  return { data: body.documents ?? [], error: null };
}

export async function fetchMyStaffDocuments(params: {
  restaurantId: string;
}): Promise<{
  data: StaffDocumentListItem[];
  staffId: string | null;
  error: string | null;
}> {
  const q = new URLSearchParams({
    restaurantId: params.restaurantId,
    scope: "my",
  });
  const res = await fetch(`/api/staff/documents?${q.toString()}`);
  const body = (await res.json().catch(() => ({}))) as {
    documents?: StaffDocumentListItem[];
    staffId?: string;
    error?: string;
  };
  if (!res.ok) {
    if (body.error === "no_staff_profile") {
      return { data: [], staffId: null, error: null };
    }
    return { data: [], staffId: null, error: body.error ?? `fetch_${res.status}` };
  }
  return {
    data: body.documents ?? [],
    staffId: body.staffId ?? null,
    error: null,
  };
}

export function downloadStaffDocument(params: {
  restaurantId: string;
  documentId: string;
}): void {
  window.open(
    restaurantDocumentDownloadUrl({
      restaurantId: params.restaurantId,
      documentId: params.documentId,
    }),
    "_blank",
    "noopener,noreferrer",
  );
}

export function staffDocumentsExportUrl(params: {
  restaurantId: string;
  staffId: string;
}): string {
  const q = new URLSearchParams({
    restaurantId: params.restaurantId,
    staffId: params.staffId,
  });
  return `/api/staff/documents/export?${q.toString()}`;
}

export async function uploadMyStaffDocument(params: {
  restaurantId: string;
  file: File;
  title?: string;
}): Promise<{ documentId?: string; error?: string }> {
  const form = new FormData();
  form.set("restaurantId", params.restaurantId);
  form.set("file", params.file);
  if (params.title?.trim()) form.set("title", params.title.trim());

  const res = await fetch("/api/staff/documents/upload", {
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const whenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatStaffDocumentMeta(doc: StaffDocumentListItem): string {
  return `${whenFmt.format(new Date(doc.created_at))} · ${formatBytes(doc.size_bytes)}`;
}
