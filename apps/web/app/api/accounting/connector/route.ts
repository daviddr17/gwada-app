import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import { getAccountingConnectorPublicInfo } from "@/lib/accounting/connectors/registry";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId, "read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const connector = await getAccountingConnectorPublicInfo(
    auth.sb,
    auth.restaurantId,
  );
  return NextResponse.json({ connector });
}
