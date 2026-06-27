import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StaffContractFormPayload } from "@/lib/staff/staff-contract-form-utils";
import type { StaffContractPayType } from "@/lib/types/staff";

export type StaffContractFieldsUpsertInput = {
  restaurantId: string;
  staffId: string;
  contractId?: string | null;
  contractFields: StaffContractFormPayload;
};

function isFixedPayType(payType: StaffContractPayType): boolean {
  return payType === "fixed" || payType === "fixed_weekly";
}

export async function upsertStaffContractFieldsRow(
  admin: SupabaseClient,
  input: StaffContractFieldsUpsertInput,
): Promise<
  | {
      ok: true;
      contractId: string;
      wasSigned: boolean;
      wasPending: boolean;
      wasPrepared: boolean;
    }
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
  let wasPrepared = false;

  if (contractId) {
    const { data: existing } = await admin
      .from("restaurant_staff_contracts")
      .select(
        "id, signed_at, employee_signature_pending, contract_body_snapshot, signature_employer",
      )
      .eq("id", contractId)
      .eq("restaurant_id", input.restaurantId)
      .maybeSingle();
    if (!existing) {
      return { ok: false, error: "contract_not_found", status: 404 };
    }
    wasSigned = Boolean(existing.signed_at);
    wasPending = Boolean(existing.employee_signature_pending);
    wasPrepared = Boolean(
      existing.contract_body_snapshot &&
        !existing.signed_at &&
        !existing.employee_signature_pending &&
        !existing.signature_employer,
    );
    if (wasSigned) {
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

  return { ok: true, contractId, wasSigned, wasPending, wasPrepared };
}

export function rejectSelfStaffContract(
  staffProfileId: string | null,
  userId: string,
): { ok: false; error: string; status: number } | null {
  if (staffProfileId && staffProfileId === userId) {
    return { ok: false, error: "self_contract_forbidden", status: 400 };
  }
  return null;
}
