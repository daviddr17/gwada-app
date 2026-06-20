import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import {
  deleteAccountingArticle,
  upsertAccountingArticle,
} from "@/lib/accounting/accounting-catalog-server";

export const dynamic = "force-dynamic";

import type { AccountingArticleRecipeLine } from "@/lib/types/accounting";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    restaurantId?: string;
    name: string;
    description?: string | null;
    default_unit_name: string;
    default_unit_price: number;
    default_tax_rate_percent: number;
    currency?: string;
    recipe?: AccountingArticleRecipeLine[] | null;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId, "create");
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
    recipe?: AccountingArticleRecipeLine[] | null;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId, "update");
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
    recipe: body.recipe,
  });
  if (error || !row) {
    return NextResponse.json({ error: error ?? "update_failed" }, { status: 400 });
  }
  return NextResponse.json({ article: row });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const restaurantId = restaurantIdFromRequest(req);
  const id = url.searchParams.get("id");
  const auth = await assertAccountingApi(restaurantId, "delete");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!id) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { error } = await deleteAccountingArticle(auth.sb, auth.restaurantId, id);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
