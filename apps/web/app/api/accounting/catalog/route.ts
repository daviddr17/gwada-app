import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import {
  listAccountingArticles,
  listAccountingTaxRates,
  listAccountingUnits,
} from "@/lib/accounting/accounting-catalog-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId, "read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const [taxRates, units, articles] = await Promise.all([
    listAccountingTaxRates(auth.sb, auth.restaurantId),
    listAccountingUnits(auth.sb, auth.restaurantId),
    listAccountingArticles(auth.sb, auth.restaurantId),
  ]);

  return NextResponse.json({ taxRates, units, articles });
}
