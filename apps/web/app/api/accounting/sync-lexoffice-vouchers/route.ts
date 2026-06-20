import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import { runAccountingSync } from "@/lib/accounting/accounting-sync-handler";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    force?: boolean;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId, "create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  const writeSb = admin ?? auth.sb;
  const result = await runAccountingSync(writeSb, {
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
