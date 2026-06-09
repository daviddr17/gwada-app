import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import { upsertAccountingArticle } from "@/lib/accounting/accounting-catalog-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    restaurantId?: string;
    name: string;
    description?: string | null;
    default_unit_name: string;
    default_unit_price: number;
    default_tax_rate_percent: number;
    currency?: string;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { row, error } = await upsertAccountingArticle(auth.sb, auth.restaurantId, body);
  if (error || !row) {
    return NextResponse.json({ error: error ?? "create_failed" }, { status: 400 });
  }
  return NextResponse.json({ article: row });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    restaurantId?: string;
    id: string;
    name?: string;
    description?: string | null;
    default_unit_name?: string;
    default_unit_price?: number;
    default_tax_rate_percent?: number;
    currency?: string;
    archived?: boolean;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!body.id || !body.name) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { row, error } = await upsertAccountingArticle(auth.sb, auth.restaurantId, {
    id: body.id,
    name: body.name,
    description: body.description,
    default_unit_name: body.default_unit_name ?? "Stück",
    default_unit_price: body.default_unit_price ?? 0,
    default_tax_rate_percent: body.default_tax_rate_percent ?? 0,
    currency: body.currency,
    archived: body.archived,
  });
  if (error || !row) {
    return NextResponse.json({ error: error ?? "update_failed" }, { status: 400 });
  }
  return NextResponse.json({ article: row });
}
