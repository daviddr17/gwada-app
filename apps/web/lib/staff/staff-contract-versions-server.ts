import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

import type { StaffContractDocumentVersionRow } from "@/lib/staff/staff-contract-versions-types";

export type { StaffContractDocumentVersionRow };

export async function fetchStaffContractDocumentVersions(params: {
  restaurantId: string;
  contractId: string;
}): Promise<
  | { ok: true; versions: StaffContractDocumentVersionRow[] }
  | { ok: false; error: string; status: number }
> {
  if (
    !isUuidRestaurantId(params.restaurantId) ||
    !isUuidRestaurantId(params.contractId)
  ) {
    return { ok: false, error: "invalid_request", status: 400 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const { data, error } = await admin
    .from("restaurant_staff_contract_document_versions")
    .select(
      `
      id,
      version,
      is_current,
      document_id,
      created_at,
      document:restaurant_documents (
        title,
        file_name,
        mime_type,
        size_bytes
      )
    `,
    )
    .eq("restaurant_id", params.restaurantId)
    .eq("contract_id", params.contractId)
    .order("version", { ascending: false });

  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }

  const versions: StaffContractDocumentVersionRow[] = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const docRaw = r.document as
      | {
          title: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
        }
      | {
          title: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
        }[]
      | null;
    const doc = Array.isArray(docRaw) ? docRaw[0] : docRaw;
    return {
      id: r.id as string,
      version: Number(r.version),
      is_current: Boolean(r.is_current),
      document_id: r.document_id as string,
      created_at: r.created_at as string,
      title: doc?.title ?? "Vertrag",
      file_name: doc?.file_name ?? "vertrag.pdf",
      mime_type: doc?.mime_type ?? "application/pdf",
      size_bytes: Number(doc?.size_bytes ?? 0),
    };
  });

  return { ok: true, versions };
}
