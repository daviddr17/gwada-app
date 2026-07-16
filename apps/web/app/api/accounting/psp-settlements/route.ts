import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import { bookPspSettlementFees } from "@/lib/accounting/accounting-psp-settlement-server";
import type { AccountingPspProvider } from "@/lib/types/accounting-pos-z-autopilot";

export const dynamic = "force-dynamic";

function parseProvider(value: unknown): AccountingPspProvider | null {
  if (value === "mollie" || value === "adyen" || value === "other") return value;
  return null;
}

/** Manuell / später Webhook: PSP-Settlement mit Gebühren buchen. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    provider?: string;
    externalSettlementId?: string;
    settlementDate?: string;
    grossCents?: number;
    feeCents?: number;
    currency?: string;
    posRegisterSessionId?: string | null;
    raw?: Record<string, unknown> | null;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId, "create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const provider = parseProvider(body.provider);
  const externalSettlementId = body.externalSettlementId?.trim() ?? "";
  const settlementDate = body.settlementDate?.trim() ?? "";
  if (!provider || !externalSettlementId || !settlementDate) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const result = await bookPspSettlementFees({
    restaurantId: auth.restaurantId,
    actorUserId: auth.userId,
    provider,
    externalSettlementId,
    settlementDate,
    grossCents: Number(body.grossCents ?? 0),
    feeCents: Number(body.feeCents ?? 0),
    currency: body.currency,
    posRegisterSessionId: body.posRegisterSessionId ?? null,
    raw: body.raw ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
