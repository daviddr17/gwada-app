import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import {
  listAccountingCashEntries,
  upsertAccountingCashEntry,
} from "@/lib/accounting/accounting-cash-book-server";
import type { AccountingCashDirection, AccountingCashEntryInput } from "@/lib/types/accounting-cash-book";

export const dynamic = "force-dynamic";

function parseDirection(value: string | null): AccountingCashDirection | "all" {
  if (value === "income" || value === "expense") return value;
  return "all";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "0") || undefined;
  const search = url.searchParams.get("q") ?? undefined;
  const direction = parseDirection(url.searchParams.get("direction"));

  try {
    const result = await listAccountingCashEntries(auth.sb, auth.restaurantId, {
      page: Number.isFinite(page) ? page : 1,
      pageSize,
      search,
      direction,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as AccountingCashEntryInput & {
    restaurantId?: string;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { row, error } = await upsertAccountingCashEntry(
    auth.sb,
    auth.restaurantId,
    body,
  );
  if (error || !row) {
    return NextResponse.json({ error: error ?? "create_failed" }, { status: 400 });
  }
  return NextResponse.json({ entry: row });
}
