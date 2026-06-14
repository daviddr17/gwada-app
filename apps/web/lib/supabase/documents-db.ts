import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { RESTAURANT_DOCUMENTS_QUOTA_BYTES } from "@/lib/constants/restaurant-documents";
import { RESTAURANT_WORKSPACE_QUOTA_BYTES } from "@/lib/constants/workspace-storage";
import type {
  DocumentTagDefinition,
  RestaurantDocumentRow,
  RestaurantDocumentUploader,
  RestaurantDocumentsStorageUsage,
} from "@/lib/types/documents";
import type { RestaurantDocumentLogEntry } from "@/lib/types/document-log";
import type { RestaurantDocumentNoteEntry } from "@/lib/types/document-notes";
import {
  formatDocumentLogActorLabel,
  type DocumentLogDetails,
} from "@/lib/types/document-log";

const TAG_SELECT =
  "id,name,is_active,sort_order,background_color" as const;

const DOCUMENT_SELECT = `
  id,
  restaurant_id,
  tag_id,
  employee_id,
  uploaded_by,
  title,
  file_name,
  storage_path,
  mime_type,
  size_bytes,
  created_at,
  tag:restaurant_document_tags (
    id,
    name,
    background_color,
    is_active
  )
`;

const LOG_SELECT = `
  id,
  restaurant_id,
  document_id,
  employee_id,
  actor_user_id,
  action,
  document_title,
  file_name,
  details,
  created_at
`;

function mapTagRow(r: {
  id: string;
  name: string;
  is_active: boolean;
  background_color: string;
}): DocumentTagDefinition {
  return {
    id: r.id,
    name: r.name,
    active: r.is_active,
    backgroundColor: r.background_color || "#64748b",
  };
}

function mapDocumentRow(
  r: Record<string, unknown>,
): RestaurantDocumentRow {
  const tagRaw = r.tag as
    | {
        id: string;
        name: string;
        background_color: string;
        is_active: boolean;
      }
    | {
        id: string;
        name: string;
        background_color: string;
        is_active: boolean;
      }[]
    | null;
  const tagOne = Array.isArray(tagRaw) ? tagRaw[0] ?? null : tagRaw;

  return {
    id: r.id as string,
    restaurant_id: r.restaurant_id as string,
    tag_id: (r.tag_id as string | null) ?? null,
    employee_id: (r.employee_id as string | null) ?? null,
    uploaded_by: (r.uploaded_by as string | null) ?? null,
    title: r.title as string,
    file_name: r.file_name as string,
    storage_path: r.storage_path as string,
    mime_type: r.mime_type as string,
    size_bytes: Number(r.size_bytes),
    created_at: r.created_at as string,
    tag: tagOne
      ? {
          id: tagOne.id,
          name: tagOne.name,
          background_color: tagOne.background_color,
          is_active: tagOne.is_active,
        }
      : null,
    uploader: null,
  };
}

export async function fetchProfileDisplayNamesByIds(
  userIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, given_name, family_name")
    .in("id", ids);
  if (error) {
    console.warn("[gwada] profiles for document uploaders", error.message);
    return new Map();
  }
  const map = new Map<string, string>();
  for (const p of data ?? []) {
    const label = [p.given_name, p.family_name]
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean)
      .join(" ");
    if (label) map.set(p.id as string, label);
  }
  return map;
}

function mapLogRow(r: Record<string, unknown>): RestaurantDocumentLogEntry {
  return {
    id: r.id as string,
    restaurant_id: r.restaurant_id as string,
    document_id: (r.document_id as string | null) ?? null,
    employee_id: (r.employee_id as string | null) ?? null,
    actor_user_id: (r.actor_user_id as string | null) ?? null,
    action: r.action as RestaurantDocumentLogEntry["action"],
    document_title: r.document_title as string,
    file_name: (r.file_name as string | null) ?? null,
    details: (r.details as DocumentLogDetails) ?? {},
    created_at: r.created_at as string,
  };
}

export function formatDocumentUploaderLabel(
  uploadedBy: string | null | undefined,
  nameByUserId: Map<string, string>,
): string {
  if (!uploadedBy) return "—";
  return nameByUserId.get(uploadedBy) ?? "—";
}

export async function fetchDocumentNoteEntries(
  restaurantId: string,
  documentId: string,
): Promise<{ data: RestaurantDocumentNoteEntry[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_document_note_entries")
    .select(
      "id, restaurant_id, document_id, employee_id, actor_user_id, body, created_at",
    )
    .eq("restaurant_id", restaurantId)
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { data: [], error: error.message };

  const actorIds = (data ?? [])
    .map((r) => r.actor_user_id as string | null)
    .filter(Boolean) as string[];
  const nameByUserId = await fetchProfileDisplayNamesByIds(actorIds);

  return {
    data: (data ?? []).map((r) => ({
      id: r.id as string,
      restaurant_id: r.restaurant_id as string,
      document_id: r.document_id as string,
      employee_id: (r.employee_id as string | null) ?? null,
      actor_user_id: (r.actor_user_id as string | null) ?? null,
      body: r.body as string,
      created_at: r.created_at as string,
      actor_label: r.actor_user_id
        ? nameByUserId.get(r.actor_user_id as string) ?? "—"
        : "—",
    })),
    error: null,
  };
}

export async function fetchDocumentLogEntries(
  restaurantId: string,
  documentId?: string | null,
): Promise<{ data: RestaurantDocumentLogEntry[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  let q = supabase
    .from("restaurant_document_log_entries")
    .select(LOG_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (documentId) {
    q = q.eq("document_id", documentId);
  }
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map((r) => mapLogRow(r as Record<string, unknown>)), error: null };
}

export function resolveDocumentLogEntryActorLabel(
  entry: RestaurantDocumentLogEntry,
): string {
  return formatDocumentLogActorLabel(entry.details);
}

export async function loadDocumentTags(
  restaurantId: string,
): Promise<{ data: DocumentTagDefinition[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_document_tags")
    .select(TAG_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map(mapTagRow), error: null };
}

export async function insertDocumentTag(
  restaurantId: string,
  name: string,
  active: boolean,
  backgroundColor: string,
): Promise<{ id: string } | null> {
  const supabase = createSupabaseBrowserClient();
  const { data: last } = await supabase
    .from("restaurant_document_tags")
    .select("sort_order")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (last?.sort_order ?? -1) + 1;
  const { data, error } = await supabase
    .from("restaurant_document_tags")
    .insert({
      restaurant_id: restaurantId,
      name,
      is_active: active,
      background_color: backgroundColor,
      sort_order: sortOrder,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return { id: data.id as string };
}

export async function updateDocumentTag(
  id: string,
  updates: {
    name?: string;
    active?: boolean;
    backgroundColor?: string;
  },
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name.trim();
  if (updates.active !== undefined) patch.is_active = updates.active;
  if (updates.backgroundColor !== undefined) {
    patch.background_color = updates.backgroundColor;
  }
  if (Object.keys(patch).length === 0) return true;
  const { error } = await supabase
    .from("restaurant_document_tags")
    .update(patch)
    .eq("id", id);
  return !error;
}

export async function deleteDocumentTag(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase
    .from("restaurant_document_tags")
    .delete()
    .eq("id", id);
  return !error;
}

export async function reorderDocumentTags(
  orderedIds: string[],
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("restaurant_document_tags")
      .update({ sort_order: i })
      .eq("id", orderedIds[i]);
    if (error) return false;
  }
  return true;
}

export async function fetchDocumentsForRestaurant(
  restaurantId: string,
): Promise<{ data: RestaurantDocumentRow[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_documents")
    .select(DOCUMENT_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map((r) => mapDocumentRow(r as Record<string, unknown>)), error: null };
}

export async function fetchDocumentsStorageUsage(
  restaurantId: string,
): Promise<{ data: RestaurantDocumentsStorageUsage; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("restaurant_workspace_storage_breakdown", {
    p_restaurant_id: restaurantId,
  });
  if (error) {
    return {
      data: {
        usedBytes: 0,
        quotaBytes: RESTAURANT_WORKSPACE_QUOTA_BYTES,
        documentsBytes: 0,
        galleryBytes: 0,
        newsBytes: 0,
        accountingBytes: 0,
      },
      error: error.message,
    };
  }
  const raw = (data ?? {}) as Record<string, number>;
  return {
    data: {
      usedBytes: Number(raw.totalBytes ?? 0),
      quotaBytes: Number(raw.quotaBytes ?? RESTAURANT_DOCUMENTS_QUOTA_BYTES),
      documentsBytes: Number(raw.documentsBytes ?? 0),
      galleryBytes: Number(raw.galleryBytes ?? 0),
      newsBytes: Number(raw.newsBytes ?? 0),
      accountingBytes: Number(raw.accountingBytes ?? 0),
    },
    error: null,
  };
}

export function buildRestaurantDocumentStoragePath(params: {
  restaurantId: string;
  documentId: string;
  fileName: string;
}): string {
  const safe = params.fileName
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 180);
  return `${params.restaurantId}/${params.documentId}/${safe || "datei"}`;
}
