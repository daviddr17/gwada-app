import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { authorizeStaffRestaurant } from "@/lib/staff/route-auth";
import {
  createSupabaseServerClient,
  insertStaffContractLogEntryServer,
  loadStaffContractStaffRow,
} from "@/lib/staff/staff-contract-pdf-finalize.server";
import { upsertStaffContractFieldsRow } from "@/lib/staff/staff-contract-row-upsert.server";
import {
  attachPdfToStaffContract,
  buildExternalContractDocumentTitle,
  parseExternalContractSignedAt,
  type StaffContractExternalSaveInput,
} from "@/lib/staff/staff-contract-external-document.server";
import type { StaffContractFormPayload } from "@/lib/staff/staff-contract-form-utils";
import {
  resolveStaffContractAttachmentMime,
  validateStaffContractAttachmentFile,
} from "@/lib/staff/validate-staff-contract-attachment-file";

function attachmentValidationError(file: File): string | null {
  return validateStaffContractAttachmentFile(file);
}

export async function saveStaffContractExternal(
  input: StaffContractExternalSaveInput,
  userId: string,
  file: File | null,
): Promise<
  | { ok: true; contractId: string; documentId: string | null }
  | { ok: false; error: string; status: number }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }
  const userSb = await createSupabaseServerClient();

  const staffRow = await loadStaffContractStaffRow(
    admin,
    input.restaurantId,
    input.staffId,
  );
  if (!staffRow) {
    return { ok: false, error: "staff_not_found", status: 404 };
  }

  if (input.contractId) {
    const { data: existing } = await admin
      .from("restaurant_staff_contracts")
      .select("contract_source, current_document_id, employee_signature_pending")
      .eq("id", input.contractId)
      .eq("restaurant_id", input.restaurantId)
      .maybeSingle();

    if (!existing) {
      return { ok: false, error: "contract_not_found", status: 404 };
    }
    if (existing.employee_signature_pending) {
      return { ok: false, error: "pending_employee_signature", status: 409 };
    }
    const isExternal = existing.contract_source === "external";
    if (!isExternal && existing.current_document_id) {
      return { ok: false, error: "document_already_attached", status: 409 };
    }
    if (!file && !existing.current_document_id) {
      return { ok: false, error: "attachment_required", status: 400 };
    }
  } else if (!file) {
    return { ok: false, error: "attachment_required", status: 400 };
  }

  if (file) {
    const validationError = attachmentValidationError(file);
    if (validationError) {
      return { ok: false, error: "invalid_attachment_type", status: 400 };
    }
    const mimeType = resolveStaffContractAttachmentMime(file);
    if (!mimeType) {
      return { ok: false, error: "invalid_attachment_type", status: 400 };
    }
  }

  const upsert = await upsertStaffContractFieldsRow(admin, input);
  if (!upsert.ok) return upsert;
  const { contractId } = upsert;

  const signedAtIso = parseExternalContractSignedAt(input.signedAt ?? null);

  let documentId: string | null = input.contractId
    ? (
        await admin
          .from("restaurant_staff_contracts")
          .select("current_document_id")
          .eq("id", contractId)
          .maybeSingle()
      ).data?.current_document_id ?? null
    : null;

  let pdfSha256: string | null = null;

  if (file) {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const mimeType = resolveStaffContractAttachmentMime(file)!;
    const docTitle = buildExternalContractDocumentTitle({
      title: input.documentTitle,
      fileName: file.name,
      staffGivenName: staffRow.given_name,
      staffFamilyName: staffRow.family_name,
    });

    const attached = await attachPdfToStaffContract({
      admin,
      userSb,
      userId,
      restaurantId: input.restaurantId,
      contractId,
      staffId: input.staffId,
      title: docTitle,
      fileName: file.name,
      fileBuffer,
      mimeType,
    });

    if (!attached.ok) return attached;
    documentId = attached.documentId;
    pdfSha256 = attached.pdfSha256;
  }

  const { error: updateError } = await admin
    .from("restaurant_staff_contracts")
    .update({
      contract_source: "external",
      contract_body_snapshot: null,
      signature_employer: null,
      signature_employee: null,
      employee_signature_pending: false,
      current_document_id: documentId,
      signed_at: signedAtIso,
      signed_by_user_id: signedAtIso ? userId : null,
    })
    .eq("id", contractId)
    .eq("restaurant_id", input.restaurantId);

  if (updateError) {
    return { ok: false, error: updateError.message, status: 500 };
  }

  const logSummary = file
    ? "Vertragsdokument hochgeladen"
    : signedAtIso
      ? "Externer Vertrag — Metadaten aktualisiert"
      : "Externer Vertrag — gespeichert";

  await insertStaffContractLogEntryServer(userSb, {
    restaurantId: input.restaurantId,
    contractId,
    actorUserId: userId,
    action: file ? "external_uploaded" : "updated",
    summary: logSummary,
    signatureEmployer: null,
    signatureEmployee: null,
    pdfSha256,
  });

  return { ok: true, contractId, documentId };
}

export async function handleStaffContractExternalSaveRequest(
  req: Request,
): Promise<Response> {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const restaurantId = String(form.get("restaurantId") ?? "").trim();
  const staffId = String(form.get("staffId") ?? "").trim();
  const contractIdRaw = form.get("contractId");
  const contractId =
    typeof contractIdRaw === "string" && contractIdRaw.trim()
      ? contractIdRaw.trim()
      : null;
  const contractFieldsRaw = form.get("contractFields");
  const documentTitleRaw = form.get("documentTitle");
  const signedAtRaw = form.get("signedAt");
  const file = form.get("file");

  if (!restaurantId || !staffId || typeof contractFieldsRaw !== "string") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  let contractFields: StaffContractFormPayload;
  try {
    contractFields = JSON.parse(contractFieldsRaw) as StaffContractFormPayload;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const auth = await authorizeStaffRestaurant(
    restaurantId,
    contractId ? "update" : "create",
  );
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await saveStaffContractExternal(
    {
      restaurantId,
      staffId,
      contractId,
      contractFields,
      documentTitle:
        typeof documentTitleRaw === "string" ? documentTitleRaw : null,
      signedAt: typeof signedAtRaw === "string" ? signedAtRaw : null,
    },
    auth.userId,
    file instanceof File && file.size > 0 ? file : null,
  );

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({
    contractId: result.contractId,
    documentId: result.documentId,
  });
}
