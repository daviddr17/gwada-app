import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import {
  deleteAccountingCashCategory,
  listAccountingCashCategories,
  reorderAccountingCashCategories,
  upsertAccountingCashCategory,
} from "@/lib/accounting/accounting-cash-book-server";
import type { AccountingCashDirection } from "@/lib/types/accounting-cash-book";

export const dynamic = "force-dynamic";

function parseDirection(value: string | null): AccountingCashDirection | null {
  if (value === "income" || value === "expense") return value;
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const direction = parseDirection(url.searchParams.get("direction"));
  const includeArchived = url.searchParams.get("includeArchived") === "1";

  const categories = await listAccountingCashCategories(
    auth.sb,
    auth.restaurantId,
    direction ?? undefined,
    includeArchived,
  );
  return NextResponse.json({ categories });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    restaurantId?: string;
    direction: AccountingCashDirection;
    name: string;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { row, error } = await upsertAccountingCashCategory(
    auth.sb,
    auth.restaurantId,
    body,
  );
  if (error || !row) {
    return NextResponse.json({ error: error ?? "create_failed" }, { status: 400 });
  }
  return NextResponse.json({ category: row });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    restaurantId?: string;
    reorder?: string[];
    direction?: AccountingCashDirection;
    id?: string;
    name?: string;
    archived?: boolean;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (body.reorder?.length && body.direction) {
    const { error } = await reorderAccountingCashCategories(
      auth.sb,
      auth.restaurantId,
      body.direction,
      body.reorder,
    );
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!body.id || !body.name || !body.direction) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { row, error } = await upsertAccountingCashCategory(
    auth.sb,
    auth.restaurantId,
    {
      id: body.id,
      direction: body.direction,
      name: body.name,
      archived: body.archived,
    },
  );
  if (error || !row) {
    return NextResponse.json({ error: error ?? "update_failed" }, { status: 400 });
  }
  return NextResponse.json({ category: row });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const restaurantId = restaurantIdFromRequest(req);
  const id = url.searchParams.get("id");
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!id) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { error } = await deleteAccountingCashCategory(
    auth.sb,
    auth.restaurantId,
    id,
  );
  if (error) {
    const status = error === "category_in_use" ? 409 : 400;
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json({ ok: true });
}
