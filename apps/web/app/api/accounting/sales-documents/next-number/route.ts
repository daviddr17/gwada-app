import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import { peekAccountingDocumentNumber } from "@/lib/accounting/accounting-document-numbering-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId, "read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const kindParam = url.searchParams.get("kind");
  const kind =
    kindParam === "quotation"
      ? "quotation"
      : kindParam === "invoice_correction"
        ? "invoice_correction"
        : "invoice";
  const referenceDate = url.searchParams.get("referenceDate");

  try {
    const voucherNumber = await peekAccountingDocumentNumber(auth.sb, {
      restaurantId: auth.restaurantId,
      kind,
      referenceDate,
    });
    return NextResponse.json({ voucherNumber });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "next_number_failed" },
      { status: 400 },
    );
  }
}
