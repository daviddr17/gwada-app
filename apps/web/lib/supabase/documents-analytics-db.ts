import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { DocumentStatsPeriod } from "@/lib/documents/compute-document-statistics";
import {
  fetchDocumentsStorageUsage,
} from "@/lib/supabase/documents-db";
import type { DocumentLogAction } from "@/lib/types/document-log";
import { startOfLocalDay } from "@/lib/reservations/month-range";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type DocumentAnalyticsRow = {
  id: string;
  tag_name: string | null;
  size_bytes: number;
  created_at: string;
  mime_type: string;
};

export type DocumentLogAnalyticsRow = {
  id: string;
  action: DocumentLogAction;
  created_at: string;
  document_id: string | null;
};

export type DocumentStatisticsBundle = {
  documents: DocumentAnalyticsRow[];
  logEntries: DocumentLogAnalyticsRow[];
  documentsBytes: number;
  periodStart: Date;
  periodEnd: Date;
};

const DOCUMENT_SELECT = `
  id,
  size_bytes,
  created_at,
  mime_type,
  tag:restaurant_document_tags ( name )
`;

const LOG_SELECT = "id, action, created_at, document_id";

function periodRange(monthsBack: DocumentStatsPeriod): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodEnd = startOfLocalDay(new Date());
  periodEnd.setHours(23, 59, 59, 999);
  const periodStart = startOfLocalDay(new Date());
  periodStart.setMonth(periodStart.getMonth() - monthsBack);
  return { periodStart, periodEnd };
}

function mapDocumentRow(raw: Record<string, unknown>): DocumentAnalyticsRow {
  const tag = raw.tag as { name?: string } | null;
  return {
    id: raw.id as string,
    tag_name: tag?.name ?? null,
    size_bytes: Number(raw.size_bytes ?? 0),
    created_at: raw.created_at as string,
    mime_type: raw.mime_type as string,
  };
}

export async function fetchDocumentStatisticsBundle(params: {
  restaurantId: string;
  monthsBack?: DocumentStatsPeriod;
}): Promise<{ data: DocumentStatisticsBundle | null; error: string | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: null, error: null };
  }

  const months = params.monthsBack ?? 12;
  const { periodStart, periodEnd } = periodRange(months);
  const sb = createSupabaseBrowserClient();

  const [documentsRes, logRes, storageRes] = await Promise.all([
    sb
      .from("restaurant_documents")
      .select(DOCUMENT_SELECT)
      .eq("restaurant_id", params.restaurantId)
      .order("created_at", { ascending: true }),
    sb
      .from("restaurant_document_log_entries")
      .select(LOG_SELECT)
      .eq("restaurant_id", params.restaurantId)
      .order("created_at", { ascending: true }),
    fetchDocumentsStorageUsage(params.restaurantId),
  ]);

  const error =
    documentsRes.error?.message ??
    logRes.error?.message ??
    storageRes.error ??
    null;
  if (error) {
    return { data: null, error };
  }

  return {
    data: {
      documents: (documentsRes.data ?? []).map((raw) =>
        mapDocumentRow(raw as Record<string, unknown>),
      ),
      logEntries: (logRes.data ?? []).map((raw) => {
        const row = raw as Record<string, unknown>;
        return {
          id: row.id as string,
          action: row.action as DocumentLogAction,
          created_at: row.created_at as string,
          document_id: (row.document_id as string | null) ?? null,
        };
      }),
      documentsBytes: storageRes.data.documentsBytes,
      periodStart,
      periodEnd,
    },
    error: null,
  };
}
