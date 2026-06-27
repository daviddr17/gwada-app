import type {
  StaffContractDigitalCompletePayload,
  StaffContractEmployeeSignPayload,
  StaffContractPreparePayload,
} from "@/lib/staff/staff-contract-digital-types";

export type SubmitStaffContractDigitalCompleteParams =
  StaffContractDigitalCompletePayload;

const ERROR_MESSAGES: Record<string, string> = {
  invalid_request: "Ungültige Anfrage.",
  invalid_signatures: "Unterschriften konnten nicht gelesen werden.",
  signature_upload_failed:
    "Unterschriften konnten nicht gespeichert werden — bitte erneut versuchen.",
  signatures_required: "Beide Unterschriften sind erforderlich.",
  staff_not_found: "Mitarbeiter nicht gefunden.",
  contract_not_found: "Vertrag nicht gefunden.",
  already_signed:
    "Vertrag wurde bereits digital unterschrieben — bitte einen neuen Vertrag anlegen.",
  storage_quota_exceeded: "Speicherplatz für Dokumente ist erschöpft.",
  server_misconfigured: "Server-Konfiguration fehlt.",
  staff_profile_required_for_two_step:
    "Für die zweistufige Unterzeichnung muss der Mitarbeiter mit einem Profil verknüpft sein.",
  consent_required: "Bitte bestätige die Einwilligung zur elektronischen Unterschrift.",
  self_contract_forbidden:
    "Du kannst keinen Arbeitsvertrag mit dir selbst abschließen.",
  external_contract: "Externe Verträge werden nicht digital über Gwada unterschrieben.",
  not_pending_signature: "Für diesen Vertrag ist keine Unterschrift ausstehend.",
  contract_not_ready: "Vertrag ist noch nicht bereit zur Unterschrift.",
  forbidden: "Keine Berechtigung.",
  title_required: "Bitte einen Vertragstitel angeben.",
  pending_employee_signature:
    "Vertrag wartet bereits auf die Unterschrift des Mitarbeiters im Profil.",
};

export async function submitStaffContractPrepare(
  params: StaffContractPreparePayload,
): Promise<
  | { ok: true; contractId: string; revised: boolean }
  | { ok: false; error: string }
> {
  const res = await fetch("/api/staff/contracts/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    contractId?: string;
    revised?: boolean;
  };

  if (!res.ok) {
    const code = json.error ?? "unknown";
    return {
      ok: false,
      error: ERROR_MESSAGES[code] ?? code,
    };
  }

  if (!json.contractId) {
    return { ok: false, error: "Unerwartete Server-Antwort." };
  }

  return {
    ok: true,
    contractId: json.contractId,
    revised: json.revised === true,
  };
}

export async function submitStaffContractDigitalComplete(
  params: SubmitStaffContractDigitalCompleteParams,
): Promise<
  | {
      ok: true;
      contractId: string;
      documentId: string | null;
      pendingEmployeeSignature: boolean;
    }
  | { ok: false; error: string }
> {
  const res = await fetch("/api/staff/contracts/digital-complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    contractId?: string;
    documentId?: string | null;
    pendingEmployeeSignature?: boolean;
  };

  if (!res.ok) {
    const code = json.error ?? "unknown";
    return {
      ok: false,
      error: ERROR_MESSAGES[code] ?? code,
    };
  }

  if (!json.contractId) {
    return { ok: false, error: "Unerwartete Server-Antwort." };
  }

  if (json.pendingEmployeeSignature) {
    return {
      ok: true,
      contractId: json.contractId,
      documentId: null,
      pendingEmployeeSignature: true,
    };
  }

  if (!json.documentId) {
    return { ok: false, error: "Unerwartete Server-Antwort." };
  }

  return {
    ok: true,
    contractId: json.contractId,
    documentId: json.documentId,
    pendingEmployeeSignature: false,
  };
}

export async function submitStaffContractEmployeeSign(
  params: StaffContractEmployeeSignPayload,
): Promise<
  | { ok: true; contractId: string; documentId: string }
  | { ok: false; error: string }
> {
  const res = await fetch("/api/staff/contracts/employee-sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    contractId?: string;
    documentId?: string;
  };

  if (!res.ok) {
    const code = json.error ?? "unknown";
    return {
      ok: false,
      error: ERROR_MESSAGES[code] ?? code,
    };
  }

  if (!json.contractId || !json.documentId) {
    return { ok: false, error: "Unerwartete Server-Antwort." };
  }

  return {
    ok: true,
    contractId: json.contractId,
    documentId: json.documentId,
  };
}

export type PendingStaffContractListItem = {
  id: string;
  title: string;
  createdAt: string;
  employerSignedAt: string | null;
};

export async function fetchPendingStaffContracts(params: {
  restaurantId: string;
}): Promise<
  | { ok: true; items: PendingStaffContractListItem[] }
  | { ok: false; error: string }
> {
  const url = new URL("/api/staff/contracts/pending-signature", window.location.origin);
  url.searchParams.set("restaurantId", params.restaurantId);

  const res = await fetch(url.toString());
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    items?: PendingStaffContractListItem[];
  };

  if (!res.ok) {
    const code = json.error ?? "unknown";
    return { ok: false, error: ERROR_MESSAGES[code] ?? code };
  }

  return { ok: true, items: json.items ?? [] };
}
