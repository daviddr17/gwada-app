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
    force?: boolean;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await runAccountingSync(auth.sb, {
    restaurantId: auth.restaurantId,
    userId: auth.userId,
    scope: "vouchers",
    force: body.force === true,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    imported: result.imported,
    updated: result.updated,
    listed: result.listed,
    skipped: result.skipped ?? false,
  });
}
