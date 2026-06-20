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
import { getAccountingConnectorForDocument } from "@/lib/accounting/connectors/registry";
import { isExternalAccountingSource } from "@/lib/accounting/accounting-source";
import type { AccountingVoucherInput } from "@/lib/types/accounting";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId, "read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let row = await getAccountingVoucher(auth.sb, auth.restaurantId, id);
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const url = new URL(req.url);
  if (url.searchParams.get("enrich") === "1" && isExternalAccountingSource(row.source)) {
    const connector = await getAccountingConnectorForDocument(
      auth.restaurantId,
      row.source,
    );
    if (connector.capabilities.canEnrichVoucherDetail) {
      row = await connector.enrichVoucher(auth.sb, {
        restaurantId: auth.restaurantId,
        row,
        userId: auth.userId,
        force: url.searchParams.get("force") === "1",
      });
    }
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
  const auth = await assertAccountingApi(restaurantId, "update");
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
  const auth = await assertAccountingApi(restaurantId, "delete");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { error } = await deleteAccountingVoucher(auth.sb, {
    restaurantId: auth.restaurantId,
    voucherId: id,
    userId: auth.userId,
  });
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
