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
  const auth = await assertAccountingApi(restaurantId);
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
    deductInventoryOnInvoice?: boolean;
    documentDesign?: import("@/lib/types/accounting-settings").AccountingDocumentDesign;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { row, error } = await upsertAccountingSettings(auth.sb, auth.restaurantId, {
    documentFormat: body.documentFormat,
    autoSyncLexoffice: body.autoSyncLexoffice,
    deductInventoryOnInvoice: body.deductInventoryOnInvoice,
    documentDesign: body.documentDesign,
  });

  if (error || !row) {
    return NextResponse.json({ error: error ?? "save_failed" }, { status: 400 });
  }
  return NextResponse.json({ settings: row });
}
