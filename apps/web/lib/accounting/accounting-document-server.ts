import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccountingInvoice } from "@/lib/accounting/accounting-invoices-server";
import { getAccountingQuotation } from "@/lib/accounting/accounting-quotations-server";
import { getAccountingSettings } from "@/lib/accounting/accounting-settings-server";
import {
  loadAccountingPdfRenderContext,
} from "@/lib/accounting/accounting-document-design";
import {
  buildAccountingPreviewInvoiceRow,
  buildAccountingPreviewQuotationRow,
} from "@/lib/accounting/accounting-document-preview-sample";
import {
  buildSalesDocumentPreviewInvoiceRow,
  buildSalesDocumentPreviewQuotationRow,
  type AccountingSalesDocumentDraftPreviewInput,
} from "@/lib/accounting/build-sales-document-preview-row";
import { generateGwadaSalesDocumentPdf } from "@/lib/accounting/generate-sales-document-pdf";
import { parseAccountingDocumentDesign } from "@/lib/types/accounting-settings";
import type { AccountingDocumentDesign } from "@/lib/types/accounting-settings";
import {
  generateGwadaZugferdXml,
  zugferdXmlFilename,
} from "@/lib/accounting/generate-zugferd-xml";
import { sendSalesDocumentNotification } from "@/lib/accounting/send-sales-document-server";
import { insertAccountingDocumentLog } from "@/lib/accounting/accounting-document-log-server";
import { isAccountingCorrectionVariant } from "@/lib/accounting/accounting-corrections";
import { getAccountingConnectorForDocument } from "@/lib/accounting/connectors/registry";
import { isExternalAccountingSource } from "@/lib/accounting/accounting-source";
import type {
  AccountingInvoiceRow,
  AccountingQuotationRow,
  AccountingRecipientSnapshot,
} from "@/lib/types/accounting";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SalesKind = "invoice" | "quotation";
type SalesRow = AccountingInvoiceRow | AccountingQuotationRow;

async function loadSalesRow(
  sb: SupabaseClient,
  restaurantId: string,
  kind: SalesKind,
  id: string,
): Promise<SalesRow | null> {
  if (kind === "invoice") {
    return getAccountingInvoice(sb, restaurantId, id);
  }
  return getAccountingQuotation(sb, restaurantId, id);
}

export async function resolveAccountingDocumentDesignPreview(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    kind: SalesKind;
    documentDesign: AccountingDocumentDesign;
  },
): Promise<
  | { ok: true; buffer: Buffer; contentType: string; filename: string }
  | { ok: false; error: string }
> {
  const design = parseAccountingDocumentDesign(params.documentDesign);
  const row =
    params.kind === "invoice"
      ? buildAccountingPreviewInvoiceRow(params.restaurantId)
      : buildAccountingPreviewQuotationRow(params.restaurantId);

  const pdfContext = await loadAccountingPdfRenderContext(
    sb,
    params.restaurantId,
    design,
  );
  const buffer = await generateGwadaSalesDocumentPdf(row, params.kind, pdfContext);
  const prefix = params.kind === "invoice" ? "Rechnung" : "Angebot";

  return {
    ok: true,
    buffer,
    contentType: "application/pdf",
    filename: `${prefix}-Vorschau.pdf`,
  };
}

export async function resolveAccountingSalesDocumentDraftPreview(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    kind: SalesKind;
    draft: AccountingSalesDocumentDraftPreviewInput;
  },
): Promise<
  | { ok: true; buffer: Buffer; contentType: string; filename: string }
  | { ok: false; error: string }
> {
  const settings = await getAccountingSettings(sb, params.restaurantId);
  const row =
    params.kind === "invoice"
      ? buildSalesDocumentPreviewInvoiceRow(params.restaurantId, params.draft)
      : buildSalesDocumentPreviewQuotationRow(params.restaurantId, params.draft);

  const pdfContext = await loadAccountingPdfRenderContext(
    sb,
    params.restaurantId,
    settings.document_design,
  );
  const buffer = await generateGwadaSalesDocumentPdf(row, params.kind, pdfContext);
  const prefix = params.kind === "invoice" ? "Rechnung" : "Angebot";

  return {
    ok: true,
    buffer,
    contentType: "application/pdf",
    filename: `${prefix}-Vorschau.pdf`,
  };
}

export async function resolveSalesDocumentPdf(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    kind: SalesKind;
    documentId: string;
  },
): Promise<
  | { ok: true; buffer: Buffer; contentType: string; filename: string }
  | { ok: false; error: string }
> {
  const row = await loadSalesRow(
    sb,
    params.restaurantId,
    params.kind,
    params.documentId,
  );
  if (!row) return { ok: false, error: "Dokument nicht gefunden." };

  const number = row.voucher_number ?? row.id.slice(0, 8);
  const isCorrection =
    isAccountingCorrectionVariant(row.document_variant) ||
    row.external_document_type === "credit_note";
  const prefix = isCorrection
    ? "Korrektur"
    : params.kind === "invoice"
      ? "Rechnung"
      : "Angebot";

  if (isExternalAccountingSource(row.source) && row.external_id) {
    const connector = await getAccountingConnectorForDocument(
      params.restaurantId,
      row.source,
    );
    if (connector.capabilities.canFetchExternalSalesPdf) {
      const file = await connector.fetchSalesDocumentFile(params.restaurantId, {
        kind: params.kind,
        row,
        format: "pdf",
      });
      if (file?.ok) {
        return {
          ok: true,
          buffer: file.buffer,
          contentType: file.contentType,
          filename: file.filename || `${prefix}-${number}.pdf`,
        };
      }
      if (file && !file.ok) return file;
    }
  }

  const settings = await getAccountingSettings(sb, params.restaurantId);
  const pdfContext = await loadAccountingPdfRenderContext(
    sb,
    params.restaurantId,
    settings.document_design,
  );
  const buffer = await generateGwadaSalesDocumentPdf(row, params.kind, pdfContext);
  return {
    ok: true,
    buffer,
    contentType: "application/pdf",
    filename: `${prefix}-${number}.pdf`,
  };
}

export async function resolveSalesDocumentXmlAttachment(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    kind: SalesKind;
    documentId: string;
  },
): Promise<
  | { ok: true; buffer: Buffer; filename: string }
  | { ok: false; error: string }
  | { ok: true; skipped: true }
> {
  const settings = await getAccountingSettings(sb, params.restaurantId);
  if (settings.document_format !== "zugferd_pdf") {
    return { ok: true, skipped: true };
  }

  const row = await loadSalesRow(
    sb,
    params.restaurantId,
    params.kind,
    params.documentId,
  );
  if (!row) {
    return { ok: true, skipped: true };
  }

  if (isExternalAccountingSource(row.source) && row.external_id) {
    const connector = await getAccountingConnectorForDocument(
      params.restaurantId,
      row.source,
    );
    if (connector.capabilities.canFetchExternalSalesXml) {
      const file = await connector.fetchSalesDocumentFile(params.restaurantId, {
        kind: params.kind,
        row,
        format: "xml",
      });
      if (file?.ok) {
        return { ok: true, buffer: file.buffer, filename: file.filename };
      }
      if (file && !file.ok) return file;
    }
  }

  const pdfContext = await loadAccountingPdfRenderContext(
    sb,
    params.restaurantId,
    settings.document_design,
  );
  const buffer = generateGwadaZugferdXml(row, params.kind, pdfContext.company);
  return {
    ok: true,
    buffer,
    filename: zugferdXmlFilename(row, params.kind),
  };
}

export async function sendSalesDocument(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    kind: SalesKind;
    documentId: string;
    userId: string;
    sendEmail: boolean;
    sendWhatsapp: boolean;
  },
): Promise<{ channels: string[]; error: string | null }> {
  const row = await loadSalesRow(
    sb,
    params.restaurantId,
    params.kind,
    params.documentId,
  );
  if (!row) return { channels: [], error: "Dokument nicht gefunden." };

  if (row.sent_at) {
    return { channels: [], error: "Bereits verschickt." };
  }

  const recipient = row.recipient_snapshot as AccountingRecipientSnapshot;
  const pdf = await resolveSalesDocumentPdf(sb, {
    restaurantId: params.restaurantId,
    kind: params.kind,
    documentId: params.documentId,
  });
  if (!pdf.ok) return { channels: [], error: pdf.error };

  const attachments: { filename: string; content: Buffer; contentType: string }[] =
    [
      {
        filename: pdf.filename,
        content: pdf.buffer,
        contentType: pdf.contentType,
      },
    ];

  const xml = await resolveSalesDocumentXmlAttachment(sb, {
    restaurantId: params.restaurantId,
    kind: params.kind,
    documentId: params.documentId,
  });
  if (xml.ok && !("skipped" in xml)) {
    attachments.push({
      filename: xml.filename,
      content: xml.buffer,
      contentType: "application/xml",
    });
  }

  const admin = createSupabaseAdminClient();
  const { data: restaurant } = await (admin ?? sb)
    .from("restaurants")
    .select("name")
    .eq("id", params.restaurantId)
    .maybeSingle();

  const documentLabel = params.kind === "invoice" ? "Rechnung" : "Angebot";
  const result = await sendSalesDocumentNotification({
    restaurantId: params.restaurantId,
    restaurantName: restaurant?.name ?? "Restaurant",
    documentLabel,
    voucherNumber: row.voucher_number,
    totalGross: row.totals?.totalGross ?? 0,
    currency: row.currency,
    recipientEmail: recipient.email ?? null,
    recipientPhone: recipient.phone ?? null,
    sendEmail: params.sendEmail,
    sendWhatsapp: params.sendWhatsapp,
    sbForName: sb,
    attachments,
  });

  if (!result.channels.length) {
    return { channels: [], error: result.error };
  }

  const table =
    params.kind === "invoice" ? "accounting_invoices" : "accounting_quotations";

  await sb
    .from(table)
    .update({
      sent_at: new Date().toISOString(),
      sent_channels: result.channels,
      status: row.status === "draft" ? "sent" : row.status,
    })
    .eq("id", params.documentId)
    .eq("restaurant_id", params.restaurantId);

  await insertAccountingDocumentLog(sb, {
    restaurantId: params.restaurantId,
    documentKind: params.kind,
    documentId: params.documentId,
    actorUserId: params.userId,
    action: "sent",
    details: {
      channels: result.channels,
      recipientName: recipient.name ?? null,
      recipientEmail: recipient.email ?? null,
      recipientPhone: recipient.phone ?? null,
      voucherNumber: row.voucher_number,
    },
  });

  return { channels: result.channels, error: null };
}
