import "server-only";

import { createAccountingInvoice } from "@/lib/accounting/accounting-invoices-server";
import {
  canCreateAccountingCorrection,
  correctionIntroductionText,
  correctionRemarkDefault,
  negateLineItems,
} from "@/lib/accounting/accounting-corrections";
import type {
  AccountingInvoiceRow,
  AccountingLineItem,
  AccountingRecipientSnapshot,
  AccountingSalesDocumentInput,
} from "@/lib/types/accounting";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PosFormalInvoiceStornoResult =
  | {
      ok: true;
      mode: "none";
    }
  | {
      ok: true;
      mode: "voided_draft";
      invoiceId: string;
      invoiceNumber: string | null;
    }
  | {
      ok: true;
      mode: "correction";
      invoiceId: string;
      invoiceNumber: string | null;
      correctionId: string;
      correctionNumber: string | null;
    }
  | {
      ok: false;
      error: string;
    };

function parseLineItems(raw: unknown): AccountingLineItem[] {
  return Array.isArray(raw) ? (raw as AccountingLineItem[]) : [];
}

function parseRecipient(raw: unknown): AccountingRecipientSnapshot {
  if (raw && typeof raw === "object") {
    return raw as AccountingRecipientSnapshot;
  }
  return { name: "Empfänger" };
}

/**
 * Storno einer formalen Rechnung, die an eine POS-Zahlung gehängt ist.
 * - Entwurf ohne Lexoffice: Status → voided
 * - sonst: Korrektur-Rechnung (Gutschrift) anlegen
 * Idempotent, wenn bereits Korrektur existiert bzw. Entwurf schon voided.
 */
export async function stornoFormalInvoiceForPosPayment(params: {
  restaurantId: string;
  paymentId: string;
  userId?: string | null;
  /** Zusätzlicher Vermerk (z. B. Barstorno). */
  remarkSuffix?: string | null;
  supabase?: SupabaseClient;
}): Promise<PosFormalInvoiceStornoResult> {
  const admin =
    params.supabase ?? createSupabaseAdminClient() ?? null;
  if (!admin) {
    return { ok: false, error: "server_misconfigured" };
  }

  const { data: invoice, error: invError } = await admin
    .from("accounting_invoices")
    .select("*")
    .eq("restaurant_id", params.restaurantId)
    .eq("pos_payment_id", params.paymentId)
    .maybeSingle();

  if (invError) {
    return { ok: false, error: invError.message };
  }
  if (!invoice) {
    return { ok: true, mode: "none" };
  }

  const row = invoice as AccountingInvoiceRow;
  if (!canCreateAccountingCorrection(row.document_variant)) {
    return { ok: true, mode: "none" };
  }

  const { data: existingCorrection } = await admin
    .from("accounting_invoices")
    .select("id, voucher_number")
    .eq("restaurant_id", params.restaurantId)
    .eq("corrects_id", row.id)
    .maybeSingle();

  if (existingCorrection) {
    return {
      ok: true,
      mode: "correction",
      invoiceId: row.id,
      invoiceNumber: row.voucher_number,
      correctionId: existingCorrection.id as string,
      correctionNumber:
        (existingCorrection.voucher_number as string | null) ?? null,
    };
  }

  if (row.status === "voided") {
    return {
      ok: true,
      mode: "voided_draft",
      invoiceId: row.id,
      invoiceNumber: row.voucher_number,
    };
  }

  const isExternal =
    row.source === "lexoffice" || Boolean(row.external_id?.trim());
  const userId = params.userId?.trim() || "";

  // Lokaler Entwurf ohne externe Buchung: nur als storniert markieren.
  if (row.status === "draft" && !isExternal) {
    const { error: voidError } = await admin
      .from("accounting_invoices")
      .update({
        status: "voided",
        updated_by: userId || null,
        remark: [
          row.remark?.trim() || null,
          "Storniert (POS).",
          params.remarkSuffix?.trim() || null,
        ]
          .filter(Boolean)
          .join(" "),
      })
      .eq("id", row.id)
      .eq("restaurant_id", params.restaurantId);

    if (voidError) {
      return { ok: false, error: voidError.message };
    }
    return {
      ok: true,
      mode: "voided_draft",
      invoiceId: row.id,
      invoiceNumber: row.voucher_number,
    };
  }

  const remarkParts = [
    correctionRemarkDefault(row.voucher_number),
    params.remarkSuffix?.trim() || null,
  ].filter(Boolean);

  const input: AccountingSalesDocumentInput = {
    recipientType: row.recipient_type,
    contactId: row.contact_id,
    recipient: parseRecipient(row.recipient_snapshot),
    voucherDate: new Date().toISOString().slice(0, 10),
    currency: row.currency || "EUR",
    taxMode: row.tax_mode,
    lineItems: negateLineItems(parseLineItems(row.line_items)),
    title: row.title
      ? `Korrektur: ${row.title}`
      : correctionIntroductionText(row.voucher_number),
    introduction: correctionIntroductionText(row.voucher_number),
    remark: remarkParts.join(" "),
    status: "open",
    finalizeOnCreate: false,
    documentVariant: "correction",
    correctsId: row.id,
    // Kein posPaymentId — Unique-Index gilt für die Ursprungsrechnung.
  };

  const { row: correction, error: createError } = await createAccountingInvoice(
    admin,
    {
      restaurantId: params.restaurantId,
      userId,
      input,
    },
  );

  if (createError || !correction) {
    return {
      ok: false,
      error: createError ?? "correction_create_failed",
    };
  }

  // Ursprung als storniert kennzeichnen (Korrektur bleibt separates Dokument).
  const { error: markError } = await admin
    .from("accounting_invoices")
    .update({
      status: "voided",
      updated_by: userId || null,
    })
    .eq("id", row.id)
    .eq("restaurant_id", params.restaurantId);

  if (markError) {
    console.warn(
      "[pos] formal invoice mark voided after correction",
      markError.message,
    );
  }

  return {
    ok: true,
    mode: "correction",
    invoiceId: row.id,
    invoiceNumber: row.voucher_number,
    correctionId: correction.id,
    correctionNumber: correction.voucher_number,
  };
}
