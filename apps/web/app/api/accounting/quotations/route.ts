import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import {
  createAccountingQuotation,
  listAccountingQuotations,
} from "@/lib/accounting/accounting-quotations-server";
import type { AccountingSalesDocumentInput } from "@/lib/types/accounting";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(req.url);
  const source = url.searchParams.get("source");
  const rows = await listAccountingQuotations(auth.sb, auth.restaurantId, source);
  return NextResponse.json({ quotations: rows });
}

export async function POST(req: Request) {
  const body = (await req.json()) as AccountingSalesDocumentInput & {
    restaurantId?: string;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { row, error } = await createAccountingQuotation(auth.sb, {
    restaurantId: auth.restaurantId,
    userId: auth.userId,
    input: body,
  });

  if (error || !row) {
    return NextResponse.json(
      { error: error ?? "create_failed" },
      { status: 400 },
    );
  }
  return NextResponse.json({ quotation: row });
}
