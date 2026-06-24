import "server-only";

import {
  RESTAURANT_DOCUMENTS_STORAGE_BUCKET,
} from "@/lib/constants/restaurant-documents";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dataUrlToPngBuffer } from "@/lib/staff/generate-staff-contract-pdf.server";
import {
  finalizeStaffContractPdfDocument,
  insertStaffContractLogEntryServer,
  parseStaffContractSignatureVersion,
  uploadStaffContractSignaturePng,
} from "@/lib/staff/staff-contract-pdf-finalize.server";
import { emitStaffContractSignedNotification } from "@/lib/notifications/notification-staff-contract-server";
import type { StaffContractEmployeeSignPayload } from "@/lib/staff/staff-contract-digital-types";
import type { StaffContractBodySnapshot } from "@/lib/types/staff-contract-templates";

export async function completeStaffContractEmployeeSign(
  input: StaffContractEmployeeSignPayload,
  userId: string,
): Promise<
  | { ok: true; contractId: string; documentId: string }
  | { ok: false; error: string; status: number }
> {
  if (!input.consentAccepted) {
    return { ok: false, error: "consent_required", status: 400 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }
  const userSb = await createSupabaseServerClient();

  const { data: staffRow } = await admin
    .from("restaurant_staff")
    .select("id, given_name, family_name, profile_id")
    .eq("restaurant_id", input.restaurantId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (!staffRow?.id) {
    return { ok: false, error: "forbidden", status: 403 };
  }

  const { data: contract } = await admin
    .from("restaurant_staff_contracts")
    .select(
      "id, staff_id, employee_signature_pending, contract_body_snapshot, signature_employer, signed_at",
    )
    .eq("id", input.contractId)
    .eq("restaurant_id", input.restaurantId)
    .maybeSingle();

  if (!contract) {
    return { ok: false, error: "contract_not_found", status: 404 };
  }

  if (contract.staff_id !== staffRow.id) {
    return { ok: false, error: "forbidden", status: 403 };
  }

  if (!contract.employee_signature_pending) {
    return { ok: false, error: "not_pending_signature", status: 409 };
  }

  const bodySnapshot = contract.contract_body_snapshot as StaffContractBodySnapshot | null;
  const signatureEmployer = contract.signature_employer as {
    signer_name: string;
    signed_at: string;
    signature_storage_path?: string | null;
  } | null;

  if (!bodySnapshot || !signatureEmployer?.signature_storage_path) {
    return { ok: false, error: "contract_not_ready", status: 400 };
  }

  const employeePng = dataUrlToPngBuffer(input.signatureEmployee.signature_data_url);
  if (!employeePng) {
    return { ok: false, error: "invalid_signatures", status: 400 };
  }

  const { data: employerBlob } = await admin.storage
    .from(RESTAURANT_DOCUMENTS_STORAGE_BUCKET)
    .download(signatureEmployer.signature_storage_path);

  if (!employerBlob) {
    return { ok: false, error: "employer_signature_missing", status: 500 };
  }

  const employerPng = Buffer.from(await employerBlob.arrayBuffer());

  const signedAt = new Date().toISOString();
  const signVersion = parseStaffContractSignatureVersion(
    signatureEmployer.signature_storage_path,
  );
  const employeePath = await uploadStaffContractSignaturePng(
    admin,
    input.restaurantId,
    input.contractId,
    "employee",
    input.signatureEmployee.signature_data_url,
    signVersion,
  );
  if (!employeePath) {
    return { ok: false, error: "signature_upload_failed", status: 500 };
  }

  const signatureEmployee = {
    signer_name: input.signatureEmployee.signer_name.trim(),
    signed_at: signedAt,
    signature_storage_path: employeePath,
  };

  const pdfResult = await finalizeStaffContractPdfDocument({
    admin,
    userSb,
    userId,
    restaurantId: input.restaurantId,
    contractId: input.contractId,
    staffId: staffRow.id as string,
    staffGivenName: staffRow.given_name as string | null,
    staffFamilyName: staffRow.family_name as string | null,
    bodySnapshot,
    signatureEmployer,
    signatureEmployee,
    employerPng,
    employeePng,
    wasSigned: Boolean(contract.signed_at),
  });

  if (!pdfResult.ok) return pdfResult;

  const { error: updateError } = await admin
    .from("restaurant_staff_contracts")
    .update({
      current_document_id: pdfResult.documentId,
      signed_at: signedAt,
      signed_by_user_id: userId,
      signature_employee: signatureEmployee,
      employee_signature_pending: false,
    })
    .eq("id", input.contractId);

  if (updateError) {
    return { ok: false, error: updateError.message, status: 500 };
  }

  await insertStaffContractLogEntryServer(userSb, {
    restaurantId: input.restaurantId,
    contractId: input.contractId,
    actorUserId: userId,
    action: "employee_signed",
    summary: "Vom Mitarbeiter im Profil unterschrieben — PDF erstellt",
    signatureEmployer,
    signatureEmployee,
  });

  await insertStaffContractLogEntryServer(userSb, {
    restaurantId: input.restaurantId,
    contractId: input.contractId,
    actorUserId: userId,
    action: "signed",
    summary: "Vertrag vollständig unterschrieben und PDF gespeichert",
    signatureEmployer,
    signatureEmployee,
    pdfSha256: pdfResult.pdfSha256,
  });

  await emitStaffContractSignedNotification(admin, {
    restaurantId: input.restaurantId,
    contractId: input.contractId,
    staffId: staffRow.id as string,
    targetProfileId: userId,
    contractTitle: pdfResult.title,
    documentId: pdfResult.documentId,
    actorUserId: userId,
    revised: false,
    pendingEmployeeSignature: false,
  });

  return { ok: true, contractId: input.contractId, documentId: pdfResult.documentId };
}

export async function handleStaffContractEmployeeSignRequest(
  req: Request,
): Promise<Response> {
  const body = (await req.json().catch(() => null)) as
    | StaffContractEmployeeSignPayload
    | null;

  if (
    !body?.restaurantId ||
    !body.contractId ||
    !body.signatureEmployee?.signature_data_url
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const userSb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await userSb.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await completeStaffContractEmployeeSign(body, user.id);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({
    contractId: result.contractId,
    documentId: result.documentId,
  });
}
