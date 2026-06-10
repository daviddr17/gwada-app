import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AccountingDocumentLogAction,
  AccountingDocumentLogDetails,
  AccountingDocumentLogEntry,
  AccountingDocumentLogKind,
} from "@/lib/types/accounting-document-log";

async function snapshotActor(
  sb: SupabaseClient,
  userId: string,
): Promise<Pick<AccountingDocumentLogDetails, "actorGivenName" | "actorFamilyName">> {
  const { data } = await sb
    .from("profiles")
    .select("given_name, family_name")
    .eq("id", userId)
    .maybeSingle();
  return {
    actorGivenName: (data?.given_name as string | null) ?? "",
    actorFamilyName: (data?.family_name as string | null) ?? "",
  };
}

export async function insertAccountingDocumentLog(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    documentKind: AccountingDocumentLogKind;
    documentId: string;
    actorUserId: string | null;
    action: AccountingDocumentLogAction;
    details?: AccountingDocumentLogDetails;
  },
): Promise<void> {
  const actor =
    params.actorUserId != null
      ? await snapshotActor(sb, params.actorUserId)
      : { actorGivenName: "", actorFamilyName: "" };

  const details: AccountingDocumentLogDetails = {
    ...actor,
    ...params.details,
    actorGivenName: params.details?.actorGivenName ?? actor.actorGivenName,
    actorFamilyName: params.details?.actorFamilyName ?? actor.actorFamilyName,
  };

  const { error } = await sb.from("accounting_document_log_entries").insert({
    restaurant_id: params.restaurantId,
    document_kind: params.documentKind,
    document_id: params.documentId,
    actor_user_id: params.actorUserId,
    action: params.action,
    details,
  });

  if (error) {
    console.warn("[gwada] accounting_document_log_entries", error.message);
  }
}

export async function listAccountingDocumentLog(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    documentKind: AccountingDocumentLogKind;
    documentId: string;
    limit?: number;
  },
): Promise<AccountingDocumentLogEntry[]> {
  const { data, error } = await sb
    .from("accounting_document_log_entries")
    .select("*")
    .eq("restaurant_id", params.restaurantId)
    .eq("document_kind", params.documentKind)
    .eq("document_id", params.documentId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 100);

  if (error) {
    console.warn("[gwada] listAccountingDocumentLog", error.message);
    return [];
  }

  return (data ?? []) as AccountingDocumentLogEntry[];
}

export function salesDocumentCreatedLogSummary(
  kind: "invoice" | "quotation",
  opts: {
    source: "gwada" | "lexoffice";
    voucherNumber?: string | null;
    documentVariant?: string | null;
    correctsNumber?: string | null;
  },
): string {
  const label = kind === "invoice" ? "Rechnung" : "Angebot";
  const number = opts.voucherNumber?.trim();
  if (opts.documentVariant === "correction") {
    const ref = opts.correctsNumber?.trim();
    return ref
      ? `Korrektur zu ${ref} angelegt${number ? ` (${number})` : ""}`
      : `Korrektur angelegt${number ? ` (${number})` : ""}`;
  }
  if (opts.source === "lexoffice") {
    return number
      ? `${label} aus Lexware importiert (${number})`
      : `${label} aus Lexware importiert`;
  }
  return number ? `${label} ${number} angelegt` : `${label} angelegt`;
}

export function voucherCreatedLogSummary(opts: {
  source: "gwada" | "lexoffice";
  voucherNumber?: string | null;
  documentVariant?: string | null;
  correctsNumber?: string | null;
}): string {
  const number = opts.voucherNumber?.trim();
  if (opts.documentVariant === "correction") {
    const ref = opts.correctsNumber?.trim();
    return ref
      ? `Korrektur zu ${ref} angelegt${number ? ` (${number})` : ""}`
      : `Korrektur angelegt${number ? ` (${number})` : ""}`;
  }
  if (opts.source === "lexoffice") {
    return number ? `Beleg aus Lexware importiert (${number})` : "Beleg aus Lexware importiert";
  }
  return number ? `Beleg ${number} angelegt` : "Beleg angelegt";
}
