import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import {
  deleteAccountingUnit,
  reorderAccountingUnits,
  upsertAccountingUnit,
} from "@/lib/accounting/accounting-catalog-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    restaurantId?: string;
    name: string;
    sort_order?: number;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId, "create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { row, error } = await upsertAccountingUnit(auth.sb, auth.restaurantId, body);
  if (error || !row) {
    return NextResponse.json({ error: error ?? "create_failed" }, { status: 400 });
  }
  return NextResponse.json({ unit: row });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    restaurantId?: string;
    reorder?: string[];
    id?: string;
    name?: string;
    archived?: boolean;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId, "update");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (body.reorder?.length) {
    const { error } = await reorderAccountingUnits(
      auth.sb,
      auth.restaurantId,
      body.reorder,
    );
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!body.id || !body.name) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { row, error } = await upsertAccountingUnit(auth.sb, auth.restaurantId, {
    id: body.id,
    name: body.name,
    archived: body.archived,
  });
  if (error || !row) {
    return NextResponse.json({ error: error ?? "update_failed" }, { status: 400 });
  }
  return NextResponse.json({ unit: row });
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

  const { error } = await deleteAccountingUnit(auth.sb, auth.restaurantId, id);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
