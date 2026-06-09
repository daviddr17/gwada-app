import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import {
  reorderAccountingTaxRates,
  upsertAccountingTaxRate,
} from "@/lib/accounting/accounting-catalog-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    restaurantId?: string;
    label: string;
    rate_percent: number;
    is_default?: boolean;
    sort_order?: number;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { row, error } = await upsertAccountingTaxRate(auth.sb, auth.restaurantId, body);
  if (error || !row) {
    return NextResponse.json({ error: error ?? "create_failed" }, { status: 400 });
  }
  return NextResponse.json({ taxRate: row });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    restaurantId?: string;
    reorder?: string[];
    id?: string;
    label?: string;
    rate_percent?: number;
    is_default?: boolean;
    archived?: boolean;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (body.reorder?.length) {
    const { error } = await reorderAccountingTaxRates(
      auth.sb,
      auth.restaurantId,
      body.reorder,
    );
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!body.id || !body.label || body.rate_percent === undefined) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { row, error } = await upsertAccountingTaxRate(auth.sb, auth.restaurantId, {
    id: body.id,
    label: body.label,
    rate_percent: body.rate_percent,
    is_default: body.is_default,
    archived: body.archived,
  });
  if (error || !row) {
    return NextResponse.json({ error: error ?? "update_failed" }, { status: 400 });
  }
  return NextResponse.json({ taxRate: row });
}
