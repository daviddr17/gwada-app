import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import {
  createAccountingInvoice,
  listAccountingInvoices,
} from "@/lib/accounting/accounting-invoices-server";
import { parseAccountingListQueryFromUrl } from "@/lib/accounting/accounting-list-query";
import type { AccountingSalesDocumentInput } from "@/lib/types/accounting";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId, "read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(req.url);
  const listQuery = parseAccountingListQueryFromUrl(url);
  if (url.searchParams.get("source")) {
    listQuery.source = url.searchParams.get("source");
  }
  const result = await listAccountingInvoices(auth.sb, auth.restaurantId, listQuery);
  return NextResponse.json({
    invoices: result.items,
    page: result.page,
    pageSize: result.pageSize,
    totalCount: result.totalCount,
    totalPages: result.totalPages,
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as AccountingSalesDocumentInput & {
    restaurantId?: string;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId, "create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { row, error } = await createAccountingInvoice(auth.sb, {
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
  return NextResponse.json({ invoice: row });
}
