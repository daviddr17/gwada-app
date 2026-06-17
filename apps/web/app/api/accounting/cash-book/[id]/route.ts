import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import {
  deleteAccountingCashEntry,
  getAccountingCashEntry,
  upsertAccountingCashEntry,
} from "@/lib/accounting/accounting-cash-book-server";
import type { AccountingCashEntryInput } from "@/lib/types/accounting-cash-book";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const entry = await getAccountingCashEntry(auth.sb, auth.restaurantId, id);
  if (!entry) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ entry });
}

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await req.json()) as Partial<AccountingCashEntryInput> & {
    restaurantId?: string;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const existing = await getAccountingCashEntry(auth.sb, auth.restaurantId, id);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { row, error } = await upsertAccountingCashEntry(
    auth.sb,
    auth.restaurantId,
    {
      id,
      entry_date: body.entry_date ?? existing.entry_date,
      direction: body.direction ?? existing.direction,
      category_id: body.category_id ?? existing.category_id,
      note: body.note !== undefined ? body.note : existing.note,
      voucher_id:
        body.voucher_id !== undefined ? body.voucher_id : existing.voucher_id,
      tax_lines:
        body.tax_lines ??
        (existing.tax_lines ?? []).map((line) => ({
          amount: line.amount,
          tax_rate_percent: line.taxRatePercent,
        })),
    },
  );

  if (error || !row) {
    return NextResponse.json({ error: error ?? "update_failed" }, { status: 400 });
  }
  return NextResponse.json({ entry: row });
}

export async function DELETE(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { error } = await deleteAccountingCashEntry(
    auth.sb,
    auth.restaurantId,
    id,
  );
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
