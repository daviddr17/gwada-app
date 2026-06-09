import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import { syncLexofficeSalesDocuments } from "@/lib/accounting/accounting-lexoffice-sync-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    kind?: "invoice" | "quotation";
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const kind = body.kind === "quotation" ? "quotation" : "invoice";
  const result = await syncLexofficeSalesDocuments(auth.sb, {
    restaurantId: auth.restaurantId,
    userId: auth.userId,
    kind,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    imported: result.imported,
    updated: result.updated,
  });
}
