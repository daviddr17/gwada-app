import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import {
  getAccountingCashBookSettings,
  updateAccountingCashBookOpeningBalance,
} from "@/lib/accounting/accounting-cash-book-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId, "read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const settings = await getAccountingCashBookSettings(
    auth.sb,
    auth.restaurantId,
  );
  return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    restaurantId?: string;
    opening_balance: number;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId, "update");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const openingBalance = Number(body.opening_balance);
  if (!Number.isFinite(openingBalance)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { row, error } = await updateAccountingCashBookOpeningBalance(
    auth.sb,
    auth.restaurantId,
    openingBalance,
  );
  if (error || !row) {
    return NextResponse.json({ error: error ?? "update_failed" }, { status: 400 });
  }
  return NextResponse.json({ settings: row });
}
