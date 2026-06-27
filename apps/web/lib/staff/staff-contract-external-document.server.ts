import "server-only";

import { createHash, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RESTAURANT_DOCUMENTS_QUOTA_BYTES,
  RESTAURANT_DOCUMENTS_STORAGE_BUCKET,
} from "@/lib/constants/restaurant-documents";
import { buildRestaurantDocumentStoragePath } from "@/lib/supabase/documents-db";
import { resolveStaffContractDocumentTagIdServer } from "@/lib/staff/staff-contract-document-tag-server";
import { insertRestaurantDocumentLog } from "@/lib/documents/document-log-server";
import type { StaffContractFormPayload } from "@/lib/staff/staff-contract-form-utils";

export async function attachPdfToStaffContract(params: {
  admin: SupabaseClient;
  userSb: SupabaseClient;
  userId: string;
  restaurantId: string;
  contractId: string;
  staffId: string;
  title: string;
  fileName: string;
  pdfBuffer: Buffer;
}): Promise<
  | { ok: true; documentId: string; pdfSha256: string }
  | { ok: false; error: string; status: number }
> {
  const pdfSha256 = createHash("sha256").update(params.pdfBuffer).digest("hex");

  const { data: usedRaw, error: usageError } = await params.admin.rpc(
    "restaurant_workspace_used_bytes",
    { p_restaurant_id: params.restaurantId },
  );
  if (usageError) {
    return { ok: false, error: usageError.message, status: 500 };
  }
  if (
    Number(usedRaw ?? 0) + params.pdfBuffer.length >
    RESTAURANT_DOCUMENTS_QUOTA_BYTES
  ) {
    return { ok: false, error: "storage_quota_exceeded", status: 413 };
  }

  const { tagId, error: tagError } = await resolveStaffContractDocumentTagIdServer(
    params.admin,
    params.restaurantId,
  );
  if (tagError || !tagId) {
    return { ok: false, error: tagError ?? "tag_error", status: 500 };
  }

  const documentId = randomUUID();
  const storagePath = buildRestaurantDocumentStoragePath({
    restaurantId: params.restaurantId,
    documentId,
    fileName: params.fileName,
  });

  const { error: uploadError } = await params.admin.storage
    .from(RESTAURANT_DOCUMENTS_STORAGE_BUCKET)
    .upload(storagePath, params.pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, error: uploadError.message, status: 500 };
  }

  const { data: employeeRow } = await params.userSb
    .from("restaurant_employees")
    .select("id")
    .eq("restaurant_id", params.restaurantId)
    .eq("profile_id", params.userId)
    .eq("is_active", true)
    .maybeSingle();

  const { error: docError } = await params.userSb.from("restaurant_documents").insert({
    id: documentId,
    restaurant_id: params.restaurantId,
    tag_id: tagId,
    employee_id: (employeeRow?.id as string | null) ?? null,
    staff_id: params.staffId,
    title: params.title.trim() || params.fileName,
    file_name: params.fileName,
    storage_path: storagePath,
    mime_type: "application/pdf",
    size_bytes: params.pdfBuffer.length,
    uploaded_by: params.userId,
  });

  if (docError) {
    await params.admin.storage
      .from(RESTAURANT_DOCUMENTS_STORAGE_BUCKET)
      .remove([storagePath]);
    const status = docError.message.includes("storage_quota_exceeded") ? 413 : 500;
    return { ok: false, error: docError.message, status };
  }

  await insertRestaurantDocumentLog(params.userSb, {
    restaurantId: params.restaurantId,
    documentId,
    employeeId: (employeeRow?.id as string | null) ?? null,
    actorUserId: params.userId,
    action: "uploaded",
    documentTitle: params.title.trim() || params.fileName,
    fileName: params.fileName,
  });

  const { data: versionRows } = await params.admin
    .from("restaurant_staff_contract_document_versions")
    .select("version")
    .eq("contract_id", params.contractId)
    .order("version", { ascending: false })
    .limit(1);

  const nextVersion = Number(versionRows?.[0]?.version ?? 0) + 1;

  await params.admin
    .from("restaurant_staff_contract_document_versions")
    .update({ is_current: false })
    .eq("contract_id", params.contractId)
    .eq("is_current", true);

  await params.admin.from("restaurant_staff_contract_document_versions").insert({
    restaurant_id: params.restaurantId,
    contract_id: params.contractId,
    document_id: documentId,
    version: nextVersion,
    is_current: true,
    actor_user_id: params.userId,
  });

  return { ok: true, documentId, pdfSha256 };
}

export function parseExternalContractSignedAt(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const date = new Date(`${trimmed}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function buildExternalContractDocumentTitle(params: {
  title?: string | null;
  fileName: string;
  staffGivenName: string | null;
  staffFamilyName: string | null;
}): string {
  const custom = params.title?.trim();
  if (custom) return custom;
  const fromFile = params.fileName.replace(/\.[^.]+$/, "").trim();
  if (fromFile) return fromFile;
  const staffName = [params.staffGivenName, params.staffFamilyName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return staffName ? `Arbeitsvertrag ${staffName}` : "Arbeitsvertrag";
}

export type StaffContractExternalSaveInput = {
  restaurantId: string;
  staffId: string;
  contractId?: string | null;
  contractFields: StaffContractFormPayload;
  documentTitle?: string | null;
  signedAt?: string | null;
};
