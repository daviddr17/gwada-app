import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import {
  getAccountingInvoice,
  updateAccountingInvoice,
} from "@/lib/accounting/accounting-invoices-server";
import type {
  AccountingInvoiceStatus,
  AccountingSalesDocumentInput,
} from "@/lib/types/accounting";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const row = await getAccountingInvoice(auth.sb, auth.restaurantId, id);
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ invoice: row });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await req.json()) as Partial<AccountingSalesDocumentInput> & {
    restaurantId?: string;
    status?: AccountingInvoiceStatus;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { row, error } = await updateAccountingInvoice(auth.sb, {
    restaurantId: auth.restaurantId,
    invoiceId: id,
    userId: auth.userId,
    input: body,
  });

  if (error || !row) {
    return NextResponse.json(
      { error: error ?? "update_failed" },
      { status: 400 },
    );
  }
  return NextResponse.json({ invoice: row });
}
