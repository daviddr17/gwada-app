import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import { listAccountingDocumentLog } from "@/lib/accounting/accounting-document-log-server";
import type { AccountingDocumentLogKind } from "@/lib/types/accounting-document-log";

export const dynamic = "force-dynamic";

function parseDocumentKind(raw: string | null): AccountingDocumentLogKind | null {
  if (raw === "invoice" || raw === "quotation" || raw === "voucher") {
    return raw;
  }
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const documentKind = parseDocumentKind(url.searchParams.get("kind"));
  const documentId = url.searchParams.get("documentId")?.trim() ?? "";
  if (!documentKind || !documentId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const entries = await listAccountingDocumentLog(auth.sb, {
    restaurantId: auth.restaurantId,
    documentKind,
    documentId,
  });

  return NextResponse.json({ entries });
}
