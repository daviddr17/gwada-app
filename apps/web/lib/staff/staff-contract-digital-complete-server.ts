import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { authorizeStaffRestaurant } from "@/lib/staff/route-auth";
import { fetchStaffModuleSettingsServer } from "@/lib/staff/staff-module-settings-server";
import {
  dataUrlToPngBuffer,
} from "@/lib/staff/generate-staff-contract-pdf.server";
import {
  createSupabaseServerClient,
  finalizeStaffContractPdfDocument,
  insertStaffContractLogEntryServer,
  loadStaffContractStaffRow,
  parseStaffContractSignatureVersion,
  resolveStaffContractSignatureVersion,
  uploadStaffContractSignaturePng,
} from "@/lib/staff/staff-contract-pdf-finalize.server";
import { emitStaffContractSignedNotification } from "@/lib/notifications/notification-staff-contract-server";
import type { StaffContractBodySnapshot } from "@/lib/types/staff-contract-templates";
import type { StaffContractPayType } from "@/lib/types/staff";
import type {
  StaffContractDigitalCompleteInput,
  StaffContractDigitalSignatureInput,
} from "@/lib/staff/staff-contract-digital-types";

export type { StaffContractDigitalSignatureInput };

function isFixedPayType(payType: StaffContractPayType): boolean {
  return payType === "fixed" || payType === "fixed_weekly";
}

async function upsertContractRow(
  admin: SupabaseClient,
  input: StaffContractDigitalCompleteInput,
): Promise<
  | { ok: true; contractId: string; wasSigned: boolean; wasPending: boolean }
  | { ok: false; error: string; status: number }
> {
  const contractRow = {
    restaurant_id: input.restaurantId,
    staff_id: input.staffId,
    valid_from: input.contractFields.valid_from,
    valid_to: input.contractFields.valid_to,
    pay_type: input.contractFields.pay_type,
    hourly_rate_cents:
      input.contractFields.pay_type === "hourly"
        ? input.contractFields.hourly_rate_cents
        : null,
    fixed_salary_cents: isFixedPayType(input.contractFields.pay_type)
      ? input.contractFields.fixed_salary_cents
      : null,
    currency: input.contractFields.currency ?? "EUR",
    note: input.contractFields.note,
    employment_type_id: input.contractFields.employment_type_id,
    vacation_days_per_year: input.contractFields.vacation_days_per_year,
    target_weekly_minutes: input.contractFields.target_weekly_minutes,
  };

  let contractId = input.contractId ?? null;
  let wasSigned = false;
  let wasPending = false;

  if (contractId) {
    const { data: existing } = await admin
      .from("restaurant_staff_contracts")
      .select("id, signed_at, employee_signature_pending")
      .eq("id", contractId)
      .eq("restaurant_id", input.restaurantId)
      .maybeSingle();
    if (!existing) {
      return { ok: false, error: "contract_not_found", status: 404 };
    }
    wasSigned = Boolean(existing.signed_at);
    wasPending = Boolean(existing.employee_signature_pending);
    if (wasSigned && !input.revise) {
      return { ok: false, error: "already_signed", status: 409 };
    }
    const { error: updateError } = await admin
      .from("restaurant_staff_contracts")
      .update(contractRow)
      .eq("id", contractId);
    if (updateError) {
      return { ok: false, error: updateError.message, status: 500 };
    }
  } else {
    const { data: inserted, error: insertError } = await admin
      .from("restaurant_staff_contracts")
      .insert(contractRow)
      .select("id")
      .single();
    if (insertError || !inserted?.id) {
      return {
        ok: false,
        error: insertError?.message ?? "contract_insert_failed",
        status: 500,
      };
    }
    contractId = inserted.id as string;
  }

  return { ok: true, contractId, wasSigned, wasPending };
}

async function completeEmployerOnlyStep(
  input: StaffContractDigitalCompleteInput,
  userId: string,
): Promise<
  | { ok: true; contractId: string; documentId: null; pendingEmployeeSignature: true }
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

  const employerPng = dataUrlToPngBuffer(input.signatureEmployer.signature_data_url);
  if (!employerPng) {
    return { ok: false, error: "invalid_signatures", status: 400 };
  }

  const staffRow = await loadStaffContractStaffRow(
    admin,
    input.restaurantId,
    input.staffId,
  );
  if (!staffRow) {
    return { ok: false, error: "staff_not_found", status: 404 };
  }
  if (!staffRow.profile_id) {
    return {
      ok: false,
      error: "staff_profile_required_for_two_step",
      status: 400,
    };
  }

  const upsert = await upsertContractRow(admin, input);
  if (!upsert.ok) return upsert;
  const { contractId, wasSigned, wasPending } = upsert;

  const { data: existingContract } = await admin
    .from("restaurant_staff_contracts")
    .select("signature_employer")
    .eq("id", contractId)
    .maybeSingle();
  const existingEmployerPath = (
    existingContract?.signature_employer as { signature_storage_path?: string } | null
  )?.signature_storage_path;
  const isRevise = Boolean(input.revise || wasSigned || wasPending);
  const signVersion = await resolveStaffContractSignatureVersion(
    admin,
    contractId,
    existingEmployerPath,
    isRevise,
  );

  const employerPath = await uploadStaffContractSignaturePng(
    admin,
    input.restaurantId,
    contractId,
    "employer",
    input.signatureEmployer.signature_data_url,
    signVersion,
  );
  if (!employerPath) {
    return { ok: false, error: "signature_upload_failed", status: 500 };
  }

  const signedAt = new Date().toISOString();
  const signatureEmployer = {
    signer_name: input.signatureEmployer.signer_name.trim(),
    signed_at: signedAt,
    signature_storage_path: employerPath,
  };

  const bodySnapshot: StaffContractBodySnapshot = {
    ...input.bodySnapshot,
    placeholders: input.bodySnapshot.placeholders ?? {},
  };

  const { error: contractUpdateError } = await admin
    .from("restaurant_staff_contracts")
    .update({
      contract_body_snapshot: bodySnapshot,
      signature_employer: signatureEmployer,
      signature_employee: null,
      employee_signature_pending: true,
      signed_at: null,
      signed_by_user_id: userId,
      current_document_id: null,
    })
    .eq("id", contractId);

  if (contractUpdateError) {
    return { ok: false, error: contractUpdateError.message, status: 500 };
  }

  const logSummary = wasSigned || wasPending
    ? "Vertrag überarbeitet — wartet auf Unterschrift des Mitarbeiters im Profil"
    : "Vom Arbeitgeber unterschrieben — wartet auf Unterschrift des Mitarbeiters im Profil";

  await insertStaffContractLogEntryServer(userSb, {
    restaurantId: input.restaurantId,
    contractId,
    actorUserId: userId,
    action: wasSigned || wasPending ? "revised" : "employer_signed",
    summary: logSummary,
    signatureEmployer,
    signatureEmployee: null,
  });

  const title =
    bodySnapshot.title.trim() ||
    `Arbeitsvertrag ${[staffRow.given_name, staffRow.family_name].filter(Boolean).join(" ")}`.trim();

  await emitStaffContractSignedNotification(admin, {
    restaurantId: input.restaurantId,
    contractId,
    staffId: input.staffId,
    targetProfileId: staffRow.profile_id,
    contractTitle: title,
    documentId: null,
    actorUserId: userId,
    revised: wasSigned || wasPending,
    pendingEmployeeSignature: true,
  });

  return {
    ok: true,
    contractId,
    documentId: null,
    pendingEmployeeSignature: true,
  };
}

export async function completeStaffContractDigital(
  input: StaffContractDigitalCompleteInput,
  userId: string,
): Promise<
  | {
      ok: true;
      contractId: string;
      documentId: string | null;
      pendingEmployeeSignature?: boolean;
    }
  | { ok: false; error: string; status: number }
> {
  const settings = await fetchStaffModuleSettingsServer(input.restaurantId);
  const employerOnly =
    settings.contractTwoStepSigning && Boolean(input.employerOnly);

  if (employerOnly) {
    return completeEmployerOnlyStep(input, userId);
  }

  if (!input.consentAccepted) {
    return { ok: false, error: "consent_required", status: 400 };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }

  const userSb = await createSupabaseServerClient();

  if (!input.signatureEmployee?.signature_data_url) {
    return { ok: false, error: "signatures_required", status: 400 };
  }

  const employerPng = dataUrlToPngBuffer(input.signatureEmployer.signature_data_url);
  const employeePng = dataUrlToPngBuffer(
    input.signatureEmployee.signature_data_url,
  );
  if (!employerPng || !employeePng) {
    return { ok: false, error: "invalid_signatures", status: 400 };
  }

  const staffRow = await loadStaffContractStaffRow(
    admin,
    input.restaurantId,
    input.staffId,
  );
  if (!staffRow) {
    return { ok: false, error: "staff_not_found", status: 404 };
  }

  const upsert = await upsertContractRow(admin, input);
  if (!upsert.ok) return upsert;
  const { contractId, wasSigned } = upsert;

  const { data: existingContract } = await admin
    .from("restaurant_staff_contracts")
    .select("signature_employer")
    .eq("id", contractId)
    .maybeSingle();
  const existingEmployerPath = (
    existingContract?.signature_employer as { signature_storage_path?: string } | null
  )?.signature_storage_path;
  const isRevise = Boolean(input.revise || wasSigned);
  const signVersion = await resolveStaffContractSignatureVersion(
    admin,
    contractId,
    existingEmployerPath,
    isRevise,
  );

  const employerPath = await uploadStaffContractSignaturePng(
    admin,
    input.restaurantId,
    contractId,
    "employer",
    input.signatureEmployer.signature_data_url,
    signVersion,
  );
  const employeePath = await uploadStaffContractSignaturePng(
    admin,
    input.restaurantId,
    contractId,
    "employee",
    input.signatureEmployee!.signature_data_url,
    signVersion,
  );
  if (!employerPath || !employeePath) {
    return { ok: false, error: "signature_upload_failed", status: 500 };
  }

  const signedAt = new Date().toISOString();
  const signatureEmployer = {
    signer_name: input.signatureEmployer.signer_name.trim(),
    signed_at: signedAt,
    signature_storage_path: employerPath,
  };
  const signatureEmployee = {
    signer_name: input.signatureEmployee!.signer_name.trim(),
    signed_at: signedAt,
    signature_storage_path: employeePath,
  };

  const bodySnapshot: StaffContractBodySnapshot = {
    ...input.bodySnapshot,
    placeholders: input.bodySnapshot.placeholders ?? {},
  };

  const pdfResult = await finalizeStaffContractPdfDocument({
    admin,
    userSb,
    userId,
    restaurantId: input.restaurantId,
    contractId,
    staffId: input.staffId,
    staffGivenName: staffRow.given_name,
    staffFamilyName: staffRow.family_name,
    bodySnapshot,
    signatureEmployer,
    signatureEmployee,
    employerPng,
    employeePng,
    wasSigned,
  });

  if (!pdfResult.ok) return pdfResult;

  const { error: contractFinalizeError } = await admin
    .from("restaurant_staff_contracts")
    .update({
      current_document_id: pdfResult.documentId,
      signed_at: signedAt,
      signed_by_user_id: userId,
      contract_body_snapshot: bodySnapshot,
      signature_employer: signatureEmployer,
      signature_employee: signatureEmployee,
      employee_signature_pending: false,
    })
    .eq("id", contractId);

  if (contractFinalizeError) {
    return { ok: false, error: contractFinalizeError.message, status: 500 };
  }

  const logAction = wasSigned ? "revised" : "signed";
  const logSummary = wasSigned
    ? "Vertrag überarbeitet, neu unterschrieben und PDF-Version erstellt"
    : "Digital unterschrieben und PDF erstellt";

  await insertStaffContractLogEntryServer(userSb, {
    restaurantId: input.restaurantId,
    contractId,
    actorUserId: userId,
    action: logAction,
    summary: logSummary,
    signatureEmployer,
    signatureEmployee,
    pdfSha256: pdfResult.pdfSha256,
  });

  await emitStaffContractSignedNotification(admin, {
    restaurantId: input.restaurantId,
    contractId,
    staffId: input.staffId,
    targetProfileId: staffRow.profile_id,
    contractTitle: pdfResult.title,
    documentId: pdfResult.documentId,
    actorUserId: userId,
    revised: wasSigned,
    pendingEmployeeSignature: false,
  });

  return { ok: true, contractId, documentId: pdfResult.documentId };
}

export async function handleStaffContractDigitalCompleteRequest(
  req: Request,
): Promise<Response> {
  const body = (await req.json().catch(() => null)) as
    | StaffContractDigitalCompleteInput
    | null;

  if (!body?.restaurantId || !body.staffId || !body.contractFields || !body.bodySnapshot) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!body.signatureEmployer) {
    return Response.json({ error: "signatures_required" }, { status: 400 });
  }

  if (!body.consentAccepted) {
    return Response.json({ error: "consent_required" }, { status: 400 });
  }

  const settings = await fetchStaffModuleSettingsServer(body.restaurantId);
  const employerOnly = settings.contractTwoStepSigning && Boolean(body.employerOnly);

  if (!employerOnly && !body.signatureEmployee?.signature_data_url) {
    return Response.json({ error: "signatures_required" }, { status: 400 });
  }

  const auth = await authorizeStaffRestaurant(
    body.restaurantId,
    body.contractId ? "update" : "create",
  );
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await completeStaffContractDigital(body, auth.userId);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({
    contractId: result.contractId,
    documentId: result.documentId,
    pendingEmployeeSignature: result.pendingEmployeeSignature ?? false,
  });
}
