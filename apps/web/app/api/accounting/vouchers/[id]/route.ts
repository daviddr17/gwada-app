import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import {
  deleteAccountingVoucher,
  getAccountingVoucher,
  updateAccountingVoucher,
} from "@/lib/accounting/accounting-vouchers-server";
import type { AccountingVoucherInput } from "@/lib/types/accounting";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const row = await getAccountingVoucher(auth.sb, auth.restaurantId, id);
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ voucher: row });
}

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await req.json()) as Partial<AccountingVoucherInput> & {
    restaurantId?: string;
    status?: string;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { restaurantId: _bodyRestaurantId, ...patch } = body;
  const { row, error } = await updateAccountingVoucher(auth.sb, {
    restaurantId: auth.restaurantId,
    voucherId: id,
    userId: auth.userId,
    input: patch,
  });

  if (error || !row) {
    return NextResponse.json(
      { error: error ?? "update_failed" },
      { status: 400 },
    );
  }
  return NextResponse.json({ voucher: row });
}

export async function DELETE(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { error } = await deleteAccountingVoucher(
    auth.sb,
    auth.restaurantId,
    id,
  );
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
