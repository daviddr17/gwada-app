import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import {
  getAccountingSettings,
  upsertAccountingSettings,
} from "@/lib/accounting/accounting-settings-server";
import type { AccountingDocumentFormat } from "@/lib/types/accounting-settings";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId, "read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const settings = await getAccountingSettings(auth.sb, auth.restaurantId);
  return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    restaurantId?: string;
    documentFormat?: AccountingDocumentFormat;
    autoSyncLexoffice?: boolean;
    connectorAutoSync?: {
      connector: import("@/lib/accounting/connectors/connector-meta").AccountingConnectorKey;
      enabled: boolean;
    };
    deductInventoryOnInvoice?: boolean;
    reverseInventoryOnInvoiceCorrection?: boolean;
    importPosZToCashBook?: boolean;
    pushPosZToLexoffice?: boolean;
    documentDesign?: import("@/lib/types/accounting-settings").AccountingDocumentDesign;
    invoiceNumberPrefix?: string;
    invoiceCorrectionNumberPrefix?: string;
    quotationNumberPrefix?: string;
    invoiceNumberIncludeYear?: boolean;
    quotationNumberIncludeYear?: boolean;
    invoiceNumberMinDigits?: number;
    quotationNumberMinDigits?: number;
    lexofficeFeatures?: Partial<import("@/lib/accounting/accounting-connector-settings").LexofficeConnectorFeatureFlags>;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId, "update");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { row, error } = await upsertAccountingSettings(auth.sb, auth.restaurantId, {
    documentFormat: body.documentFormat,
    autoSyncLexoffice: body.autoSyncLexoffice,
    connectorAutoSync: body.connectorAutoSync,
    deductInventoryOnInvoice: body.deductInventoryOnInvoice,
    reverseInventoryOnInvoiceCorrection: body.reverseInventoryOnInvoiceCorrection,
    importPosZToCashBook: body.importPosZToCashBook,
    pushPosZToLexoffice: body.pushPosZToLexoffice,
    documentDesign: body.documentDesign,
    invoiceNumberPrefix: body.invoiceNumberPrefix,
    invoiceCorrectionNumberPrefix: body.invoiceCorrectionNumberPrefix,
    quotationNumberPrefix: body.quotationNumberPrefix,
    invoiceNumberIncludeYear: body.invoiceNumberIncludeYear,
    quotationNumberIncludeYear: body.quotationNumberIncludeYear,
    invoiceNumberMinDigits: body.invoiceNumberMinDigits,
    quotationNumberMinDigits: body.quotationNumberMinDigits,
    lexofficeFeatures: body.lexofficeFeatures,
  });

  if (error || !row) {
    return NextResponse.json({ error: error ?? "save_failed" }, { status: 400 });
  }
  return NextResponse.json({ settings: row });
}
