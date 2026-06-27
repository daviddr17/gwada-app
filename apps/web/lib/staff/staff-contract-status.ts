import type {
  RestaurantStaffContractRow,
  StaffContractSource,
} from "@/lib/types/staff";

type StaffContractStatusInput = Pick<
  RestaurantStaffContractRow,
  | "signed_at"
  | "employee_signature_pending"
  | "contract_body_snapshot"
  | "signature_employer"
  | "contract_source"
  | "current_document_id"
>;

export function isStaffContractExternal(
  contract: Pick<RestaurantStaffContractRow, "contract_source"> | null | undefined,
): boolean {
  return contract?.contract_source === "external";
}

/** Plattform: digital abgeschlossen. Extern: nur mit Unterschriftsdatum. */
export function isStaffContractSigned(
  contract: StaffContractStatusInput | null | undefined,
): boolean {
  if (!contract) return false;
  if (isStaffContractExternal(contract)) {
    return Boolean(contract.signed_at);
  }
  return Boolean(contract.signed_at || contract.current_document_id);
}

/** Vertragsstammdaten nicht mehr ändern (PDF ist maßgeblich). */
export function isStaffContractTermsLocked(
  contract: StaffContractStatusInput | null | undefined,
): boolean {
  if (!contract) return false;
  if (contract.employee_signature_pending) return true;
  if (isStaffContractExternal(contract)) {
    return Boolean(contract.signed_at);
  }
  return Boolean(contract.signed_at || contract.current_document_id);
}

/** Extern: PDF liegt vor, aber noch kein Unterschriftsdatum — Stammdaten editierbar. */
export function isStaffContractExternalMetadataEditable(
  contract: StaffContractStatusInput | null | undefined,
): boolean {
  return (
    isStaffContractExternal(contract) &&
    Boolean(contract?.current_document_id) &&
    !contract?.signed_at &&
    !contract?.employee_signature_pending
  );
}

/** Vertragstext gespeichert, noch keine Unterschrift — bereit zum Vor-Ort-Abschluss. */
export function isStaffContractPrepared(
  contract: StaffContractStatusInput | null | undefined,
): boolean {
  if (isStaffContractExternal(contract)) return false;
  if (!contract?.contract_body_snapshot) return false;
  if (contract.signed_at) return false;
  if (contract.employee_signature_pending) return false;
  if (contract.signature_employer) return false;
  return true;
}

export type StaffContractBadgeKind =
  | "draft"
  | "pending_employee"
  | "signed"
  | "external_draft"
  | "external_open"
  | "external_signed";

export function staffContractBadgeKind(
  contract: StaffContractStatusInput | null | undefined,
): StaffContractBadgeKind {
  if (isStaffContractExternal(contract)) {
    if (contract?.signed_at) return "external_signed";
    if (contract?.current_document_id) return "external_open";
    return "external_draft";
  }
  if (contract?.employee_signature_pending) return "pending_employee";
  if (isStaffContractSigned(contract)) return "signed";
  return "draft";
}

export function defaultStaffContractSource(
  contract: Pick<RestaurantStaffContractRow, "contract_source"> | null | undefined,
): StaffContractSource {
  return contract?.contract_source === "external" ? "external" : "platform";
}
