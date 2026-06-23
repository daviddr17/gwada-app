import { findOverlappingStaffContract } from "@/lib/staff/staff-contract-period";
import {
  isStaffFixedPayType,
  staffFixedPayValidationError,
} from "@/lib/staff/staff-contract-pay";
import type {
  RestaurantStaffContractRow,
  StaffContractPayType,
  StaffEmploymentTypeDefinition,
} from "@/lib/types/staff";

export type StaffContractFormState = {
  validFrom: string;
  validTo: string;
  payType: StaffContractPayType;
  hourly: string;
  fixed: string;
  employmentTypeId: string;
  vacationDays: string;
  targetWeeklyHours: string;
  note: string;
};

export type StaffContractFormPayload = {
  valid_from: string;
  valid_to: string | null;
  pay_type: StaffContractPayType;
  hourly_rate_cents: number | null;
  fixed_salary_cents: number | null;
  currency: "EUR";
  note: string | null;
  employment_type_id: string | null;
  employment_type_name: string | null;
  vacation_days_per_year: number | null;
  target_weekly_minutes: number | null;
};

export type StaffContractFormValidationResult =
  | { ok: true; payload: StaffContractFormPayload }
  | { ok: false; error: string };

export function validateStaffContractForm(params: {
  form: StaffContractFormState;
  employmentTypes: readonly StaffEmploymentTypeDefinition[];
  existingContracts: readonly RestaurantStaffContractRow[];
  editId?: string | null;
}): StaffContractFormValidationResult {
  const { form, employmentTypes, existingContracts, editId } = params;

  if (!form.validFrom.trim()) {
    return { ok: false, error: "Bitte „Gültig von“ angeben." };
  }
  if (form.validTo && form.validTo < form.validFrom) {
    return {
      ok: false,
      error: "„Gültig bis“ darf nicht vor „Gültig von“ liegen.",
    };
  }

  const vacationTrim = form.vacationDays.trim();
  let vacationDaysPerYear: number | null = null;
  if (vacationTrim) {
    const n = Number.parseInt(vacationTrim, 10);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, error: "Urlaubstage müssen eine gültige Zahl ≥ 0 sein." };
    }
    vacationDaysPerYear = n;
  }

  let targetWeeklyMinutes: number | null = null;
  const targetRaw = form.targetWeeklyHours.trim();
  if (targetRaw) {
    const parsed = Number.parseFloat(targetRaw.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return {
        ok: false,
        error: "Bitte gültige Soll-Wochenstunden angeben oder leer lassen.",
      };
    }
    targetWeeklyMinutes = Math.round(parsed * 60);
  }

  let hourlyCents: number | null = null;
  let fixedCents: number | null = null;

  if (form.payType === "hourly") {
    const raw = form.hourly.trim();
    if (!raw) {
      return { ok: false, error: "Bitte einen Stundenlohn angeben." };
    }
    const parsed = Number.parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return {
        ok: false,
        error: "Bitte einen gültigen Stundenlohn größer als 0 angeben.",
      };
    }
    hourlyCents = Math.round(parsed * 100);
  } else if (isStaffFixedPayType(form.payType)) {
    const raw = form.fixed.trim();
    if (!raw) {
      return {
        ok: false,
        error:
          form.payType === "fixed_weekly"
            ? "Bitte einen Wochen-Festlohn angeben."
            : "Bitte einen Festlohn angeben.",
      };
    }
    const parsed = Number.parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { ok: false, error: staffFixedPayValidationError(form.payType) };
    }
    fixedCents = Math.round(parsed * 100);
  }

  const selectedEmployment = employmentTypes.find(
    (t) => t.id === form.employmentTypeId,
  );

  const payload: StaffContractFormPayload = {
    valid_from: form.validFrom,
    valid_to: form.validTo || null,
    pay_type: form.payType,
    hourly_rate_cents: hourlyCents,
    fixed_salary_cents: fixedCents,
    currency: "EUR",
    note: form.note.trim() || null,
    employment_type_id: form.employmentTypeId || null,
    employment_type_name: selectedEmployment?.name ?? null,
    vacation_days_per_year: vacationDaysPerYear,
    target_weekly_minutes: targetWeeklyMinutes,
  };

  const overlap = findOverlappingStaffContract(
    existingContracts,
    payload.valid_from,
    payload.valid_to,
    editId ?? undefined,
  );
  if (overlap) {
    return {
      ok: false,
      error:
        "Der Zeitraum überschneidet sich mit einem bestehenden Vertrag.",
    };
  }

  return { ok: true, payload };
}

export function staffContractFormStateFromContract(
  contract: RestaurantStaffContractRow | null,
): StaffContractFormState {
  if (!contract) {
    return {
      validFrom: new Date().toISOString().slice(0, 10),
      validTo: "",
      payType: "hourly",
      hourly: "",
      fixed: "",
      employmentTypeId: "",
      vacationDays: "",
      targetWeeklyHours: "",
      note: "",
    };
  }
  return {
    validFrom: contract.valid_from,
    validTo: contract.valid_to ?? "",
    payType: contract.pay_type,
    hourly:
      contract.hourly_rate_cents != null
        ? String(contract.hourly_rate_cents / 100)
        : "",
    fixed:
      contract.fixed_salary_cents != null
        ? String(contract.fixed_salary_cents / 100)
        : "",
    employmentTypeId: contract.employment_type_id ?? "",
    vacationDays:
      contract.vacation_days_per_year != null
        ? String(contract.vacation_days_per_year)
        : "",
    targetWeeklyHours:
      contract.target_weekly_minutes != null
        ? String(Math.round((contract.target_weekly_minutes / 60) * 10) / 10)
        : "",
    note: contract.note ?? "",
  };
}
