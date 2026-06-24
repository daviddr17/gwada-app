import "server-only";

import { createHash, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RESTAURANT_DOCUMENTS_QUOTA_BYTES,
  RESTAURANT_DOCUMENTS_STORAGE_BUCKET,
} from "@/lib/constants/restaurant-documents";
import { insertRestaurantDocumentLog } from "@/lib/documents/document-log-server";
import { buildRestaurantDocumentStoragePath } from "@/lib/supabase/documents-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  dataUrlToPngBuffer,
  generateStaffContractPdfBuffer,
} from "@/lib/staff/generate-staff-contract-pdf.server";
import { resolveStaffContractDocumentTagIdServer } from "@/lib/staff/staff-contract-document-tag-server";
import { emitStaffContractSignedNotification } from "@/lib/notifications/notification-staff-contract-server";
import type { StaffContractBodySnapshot } from "@/lib/types/staff-contract-templates";
import type { StaffContractSignatureSnapshot } from "@/lib/types/staff-contract-templates";
import type { StaffContractLogAction } from "@/lib/types/staff";

function formatSignedAtDe(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function parseStaffContractSignatureVersion(
  storagePath: string | null | undefined,
): number {
  const match = storagePath?.match(/\/v(\d+)\/signature-/);
  if (!match?.[1]) return 1;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function resolveStaffContractSignatureVersion(
  admin: SupabaseClient,
  contractId: string,
  existingEmployerPath: string | null | undefined,
  isRevise: boolean,
): Promise<number> {
  if (isRevise && existingEmployerPath) {
    return parseStaffContractSignatureVersion(existingEmployerPath) + 1;
  }
  const { data: versionRows } = await admin
    .from("restaurant_staff_contract_document_versions")
    .select("version")
    .eq("contract_id", contractId)
    .order("version", { ascending: false })
    .limit(1);
  const maxDocVersion = Number(versionRows?.[0]?.version ?? 0);
  return maxDocVersion > 0 ? maxDocVersion + 1 : 1;
}

export async function uploadStaffContractSignaturePng(
  admin: SupabaseClient,
  restaurantId: string,
  contractId: string,
  role: "employer" | "employee",
  dataUrl: string,
  version: number,
): Promise<string | null> {
  const buffer = dataUrlToPngBuffer(dataUrl);
  if (!buffer || buffer.length < 32) return null;
  const safeVersion = Math.max(1, version);
  const path = `${restaurantId}/staff-contracts/${contractId}/v${safeVersion}/signature-${role}.png`;
  const { error } = await admin.storage
    .from(RESTAURANT_DOCUMENTS_STORAGE_BUCKET)
    .upload(path, buffer, { contentType: "image/png", upsert: true });
  if (error) {
    console.error("[gwada] staff contract signature upload", {
      path,
      message: error.message,
    });
    return null;
  }
  return path;
}

export async function insertStaffContractLogEntryServer(
  userSb: SupabaseClient,
  params: {
    restaurantId: string;
    contractId: string;
    actorUserId: string;
    action: StaffContractLogAction;
    summary: string;
    signatureEmployer?: StaffContractSignatureSnapshot | null;
    signatureEmployee?: StaffContractSignatureSnapshot | null;
    pdfSha256?: string | null;
  },
): Promise<void> {
  const { data: profile } = await userSb
    .from("profiles")
    .select("given_name, family_name")
    .eq("id", params.actorUserId)
    .maybeSingle();

  await userSb.from("restaurant_staff_contract_log_entries").insert({
    restaurant_id: params.restaurantId,
    contract_id: params.contractId,
    actor_user_id: params.actorUserId,
    action: params.action,
    details: {
      actorGivenName: (profile?.given_name as string | null) ?? "",
      actorFamilyName: (profile?.family_name as string | null) ?? "",
      changes: [],
      summary: params.summary,
      signatureEmployer: params.signatureEmployer ?? null,
      signatureEmployee: params.signatureEmployee ?? null,
      pdfSha256: params.pdfSha256 ?? null,
    },
  });
}

export async function finalizeStaffContractPdfDocument(params: {
  admin: SupabaseClient;
  userSb: SupabaseClient;
  userId: string;
  restaurantId: string;
  contractId: string;
  staffId: string;
  staffGivenName: string | null;
  staffFamilyName: string | null;
  bodySnapshot: StaffContractBodySnapshot;
  signatureEmployer: StaffContractSignatureSnapshot;
  signatureEmployee: StaffContractSignatureSnapshot;
  employerPng: Buffer;
  employeePng: Buffer;
  wasSigned: boolean;
}): Promise<
  | { ok: true; documentId: string; title: string; pdfSha256: string }
  | { ok: false; error: string; status: number }
> {
  const pdfBuffer = await generateStaffContractPdfBuffer({
    title: params.bodySnapshot.title,
    paragraphs: params.bodySnapshot.paragraphs,
    employerSignature: {
      name: params.signatureEmployer.signer_name,
      signedAtLabel: formatSignedAtDe(params.signatureEmployer.signed_at),
      imagePng: params.employerPng,
    },
    employeeSignature: {
      name: params.signatureEmployee.signer_name,
      signedAtLabel: formatSignedAtDe(params.signatureEmployee.signed_at),
      imagePng: params.employeePng,
    },
  });

  const pdfSha256 = createHash("sha256").update(pdfBuffer).digest("hex");

  const { data: usedRaw, error: usageError } = await params.admin.rpc(
    "restaurant_workspace_used_bytes",
    { p_restaurant_id: params.restaurantId },
  );
  if (usageError) {
    return { ok: false, error: usageError.message, status: 500 };
  }
  if (Number(usedRaw ?? 0) + pdfBuffer.length > RESTAURANT_DOCUMENTS_QUOTA_BYTES) {
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
  const staffName = [params.staffGivenName, params.staffFamilyName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const fileName = `Arbeitsvertrag_${staffName.replace(/\s+/g, "_") || "Mitarbeiter"}.pdf`;
  const title =
    params.bodySnapshot.title.trim() || `Arbeitsvertrag ${staffName}`.trim();
  const storagePath = buildRestaurantDocumentStoragePath({
    restaurantId: params.restaurantId,
    documentId,
    fileName,
  });

  const { error: uploadError } = await params.admin.storage
    .from(RESTAURANT_DOCUMENTS_STORAGE_BUCKET)
    .upload(storagePath, pdfBuffer, {
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
    title,
    file_name: fileName,
    storage_path: storagePath,
    mime_type: "application/pdf",
    size_bytes: pdfBuffer.length,
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
    documentTitle: title,
    fileName,
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

  return { ok: true, documentId, title, pdfSha256 };
}

export async function loadStaffContractStaffRow(
  admin: SupabaseClient,
  restaurantId: string,
  staffId: string,
) {
  const { data } = await admin
    .from("restaurant_staff")
    .select("id, given_name, family_name, profile_id")
    .eq("id", staffId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return data as {
    id: string;
    given_name: string | null;
    family_name: string | null;
    profile_id: string | null;
  } | null;
}

export { createSupabaseServerClient };
