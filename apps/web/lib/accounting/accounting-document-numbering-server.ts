import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccountingSettings } from "@/lib/accounting/accounting-settings-server";
import {
  formatAccountingDocumentNumber,
  numberingSettingsFromRow,
  type AccountingDocumentKind,
} from "@/lib/accounting/accounting-document-numbering";

export async function peekAccountingDocumentSequence(
  sb: SupabaseClient,
  restaurantId: string,
  kind: AccountingDocumentKind,
): Promise<number> {
  const { data, error } = await sb.rpc("peek_accounting_document_number", {
    p_restaurant_id: restaurantId,
    p_kind: kind,
  });

  if (error) {
    throw new Error(error.message);
  }

  return typeof data === "number" ? data : Number(data);
}

export async function allocateAccountingDocumentSequence(
  sb: SupabaseClient,
  restaurantId: string,
  kind: AccountingDocumentKind,
): Promise<number> {
  const { data, error } = await sb.rpc("allocate_accounting_document_number", {
    p_restaurant_id: restaurantId,
    p_kind: kind,
  });

  if (error) {
    throw new Error(error.message);
  }

  return typeof data === "number" ? data : Number(data);
}

export async function peekAccountingDocumentNumber(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    kind: AccountingDocumentKind;
    referenceDate?: string | null;
  },
): Promise<string> {
  const [settings, sequence] = await Promise.all([
    getAccountingSettings(sb, params.restaurantId),
    peekAccountingDocumentSequence(sb, params.restaurantId, params.kind),
  ]);

  return formatAccountingDocumentNumber(
    numberingSettingsFromRow(settings),
    params.kind,
    sequence,
    params.referenceDate,
  );
}

export async function allocateAccountingDocumentNumber(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    kind: AccountingDocumentKind;
    referenceDate?: string | null;
  },
): Promise<string> {
  const [settings, sequence] = await Promise.all([
    getAccountingSettings(sb, params.restaurantId),
    allocateAccountingDocumentSequence(sb, params.restaurantId, params.kind),
  ]);

  return formatAccountingDocumentNumber(
    numberingSettingsFromRow(settings),
    params.kind,
    sequence,
    params.referenceDate,
  );
}
