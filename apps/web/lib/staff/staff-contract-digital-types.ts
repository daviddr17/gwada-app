import type { StaffContractBodySnapshot } from "@/lib/types/staff-contract-templates";
import type { StaffContractFormPayload } from "@/lib/staff/staff-contract-form-utils";

export type StaffContractDigitalSignatureInput = {
  signer_name: string;
  /** Wird serverseitig gesetzt — Client-Wert wird ignoriert. */
  signed_at?: string;
  signature_data_url: string;
};

export type StaffContractDigitalCompletePayload = {
  restaurantId: string;
  staffId: string;
  contractId?: string | null;
  contractFields: StaffContractFormPayload;
  bodySnapshot: StaffContractBodySnapshot;
  signatureEmployer: StaffContractDigitalSignatureInput;
  signatureEmployee?: StaffContractDigitalSignatureInput | null;
  /** Nur Arbeitgeber-Unterschrift (Zweit-Schritt-Modus). */
  employerOnly?: boolean;
  revise?: boolean;
  /** Einwilligung zur elektronischen Unterzeichnung ohne QES. */
  consentAccepted: boolean;
};

export type StaffContractEmployeeSignPayload = {
  restaurantId: string;
  contractId: string;
  signatureEmployee: StaffContractDigitalSignatureInput;
  consentAccepted: boolean;
};

/** Server-intern — gleiche Form wie API-Payload. */
export type StaffContractDigitalCompleteInput = StaffContractDigitalCompletePayload;
