import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import { runAccountingSync } from "@/lib/accounting/accounting-sync-handler";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    scope?: "sales" | "vouchers";
    kind?: "invoice" | "quotation";
    force?: boolean;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scope = body.scope === "vouchers" ? "vouchers" : "sales";
  const result = await runAccountingSync(auth.sb, {
    restaurantId: auth.restaurantId,
    userId: auth.userId,
    scope,
    kind: body.kind === "quotation" ? "quotation" : "invoice",
    force: body.force === true,
  });

  if (result.error && !result.skipped) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    connector: scope,
    imported: result.imported,
    updated: result.updated,
    listed: result.listed,
    skipped: result.skipped ?? false,
    error: result.error ?? null,
  });
}
