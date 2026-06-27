import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { authorizeStaffRestaurant } from "@/lib/staff/route-auth";
import {
  createSupabaseServerClient,
  insertStaffContractLogEntryServer,
} from "@/lib/staff/staff-contract-pdf-finalize.server";
import { upsertStaffContractFieldsRow } from "@/lib/staff/staff-contract-row-upsert.server";
import type { StaffContractPrepareInput } from "@/lib/staff/staff-contract-digital-types";
import type { StaffContractBodySnapshot } from "@/lib/types/staff-contract-templates";

export type { StaffContractPrepareInput };

export async function prepareStaffContractDigital(
  input: StaffContractPrepareInput,
  userId: string,
): Promise<
  | { ok: true; contractId: string; revised: boolean }
  | { ok: false; error: string; status: number }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, error: "server_misconfigured", status: 503 };
  }
  const userSb = await createSupabaseServerClient();

  if (input.contractId) {
    const { data: existingState } = await admin
      .from("restaurant_staff_contracts")
      .select(
        "employee_signature_pending, signed_at, contract_source",
      )
      .eq("id", input.contractId)
      .eq("restaurant_id", input.restaurantId)
      .maybeSingle();
    if (existingState?.contract_source === "external") {
      return { ok: false, error: "external_contract", status: 409 };
    }
    if (existingState?.signed_at) {
      return { ok: false, error: "already_signed", status: 409 };
    }
    if (existingState?.employee_signature_pending) {
      return {
        ok: false,
        error: "pending_employee_signature",
        status: 409,
      };
    }
  }

  const upsert = await upsertStaffContractFieldsRow(admin, input);
  if (!upsert.ok) return upsert;
  const { contractId, wasSigned, wasPending, wasPrepared } = upsert;

  if (wasSigned) {
    return { ok: false, error: "already_signed", status: 409 };
  }
  if (wasPending) {
    return { ok: false, error: "pending_employee_signature", status: 409 };
  }

  const bodySnapshot: StaffContractBodySnapshot = {
    ...input.bodySnapshot,
    placeholders: input.bodySnapshot.placeholders ?? {},
  };

  const { error: updateError } = await admin
    .from("restaurant_staff_contracts")
    .update({
      contract_body_snapshot: bodySnapshot,
      signature_employer: null,
      signature_employee: null,
      employee_signature_pending: false,
      signed_at: null,
      signed_by_user_id: null,
      current_document_id: null,
    })
    .eq("id", contractId)
    .eq("restaurant_id", input.restaurantId);

  if (updateError) {
    return { ok: false, error: updateError.message, status: 500 };
  }

  const logSummary = wasPrepared
    ? "Entwurf aktualisiert — weiterhin ohne Unterschrift"
    : "Entwurf gespeichert — Unterschrift folgt vor Ort";

  await insertStaffContractLogEntryServer(userSb, {
    restaurantId: input.restaurantId,
    contractId,
    actorUserId: userId,
    action: "prepared",
    summary: logSummary,
    signatureEmployer: null,
    signatureEmployee: null,
  });

  return { ok: true, contractId, revised: wasPrepared };
}

export async function handleStaffContractPrepareRequest(
  req: Request,
): Promise<Response> {
  const body = (await req.json().catch(() => null)) as
    | StaffContractPrepareInput
    | null;

  if (
    !body?.restaurantId ||
    !body.staffId ||
    !body.contractFields ||
    !body.bodySnapshot
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!body.bodySnapshot.title?.trim()) {
    return Response.json({ error: "title_required" }, { status: 400 });
  }

  const auth = await authorizeStaffRestaurant(
    body.restaurantId,
    body.contractId ? "update" : "create",
  );
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await prepareStaffContractDigital(body, auth.userId);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({
    contractId: result.contractId,
    revised: result.revised,
  });
}
