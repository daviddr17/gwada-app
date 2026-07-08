import type { StaffContractFormPayload } from "@/lib/staff/staff-contract-form-utils";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_request: "Ungültige Anfrage.",
  attachment_required: "Bitte eine PDF- oder Bilddatei auswählen.",
  invalid_attachment_type: "Nur PDF, JPEG oder PNG sind erlaubt.",
  staff_not_found: "Mitarbeiter nicht gefunden.",
  contract_not_found: "Vertrag nicht gefunden.",
  document_already_attached: "Für diesen Vertrag liegt bereits ein Dokument vor.",
  not_external_contract: "Kein externer Vertrag.",
  already_signed: "Vertrag wurde bereits abgeschlossen.",
  pending_employee_signature:
    "Vertrag wartet auf Unterschrift im Profil — kein externer Upload möglich.",
  storage_quota_exceeded: "Speicherplatz für Dokumente ist erschöpft.",
  server_misconfigured: "Server-Konfiguration fehlt.",
  forbidden: "Keine Berechtigung.",
};

export async function submitStaffContractExternal(params: {
  restaurantId: string;
  staffId: string;
  contractId?: string | null;
  contractFields: StaffContractFormPayload;
  file?: File | null;
  documentTitle?: string;
  signedAt?: string | null;
}): Promise<
  | { ok: true; contractId: string; documentId: string | null }
  | { ok: false; error: string }
> {
  const form = new FormData();
  form.set("restaurantId", params.restaurantId);
  form.set("staffId", params.staffId);
  form.set("contractFields", JSON.stringify(params.contractFields));
  if (params.contractId) form.set("contractId", params.contractId);
  if (params.documentTitle?.trim()) {
    form.set("documentTitle", params.documentTitle.trim());
  }
  if (params.signedAt?.trim()) form.set("signedAt", params.signedAt.trim());
  if (params.file) form.set("file", params.file);

  const res = await fetch("/api/staff/contracts/external", {
    method: "POST",
    body: form,
  });

  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    contractId?: string;
    documentId?: string | null;
  };

  if (!res.ok) {
    const code = json.error ?? "unknown";
    return { ok: false, error: ERROR_MESSAGES[code] ?? code };
  }

  if (!json.contractId) {
    return { ok: false, error: "Unerwartete Server-Antwort." };
  }

  return {
    ok: true,
    contractId: json.contractId,
    documentId: json.documentId ?? null,
  };
}

export { ERROR_MESSAGES as STAFF_CONTRACT_EXTERNAL_ERROR_MESSAGES };
