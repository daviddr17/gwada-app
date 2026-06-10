import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import { updateAccountingQuotation } from "@/lib/accounting/accounting-quotations-server";
import type {
  AccountingQuotationStatus,
  AccountingSalesDocumentInput,
} from "@/lib/types/accounting";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await req.json()) as Partial<AccountingSalesDocumentInput> & {
    restaurantId?: string;
    status?: AccountingQuotationStatus;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { row, error } = await updateAccountingQuotation(auth.sb, {
    restaurantId: auth.restaurantId,
    quotationId: id,
    userId: auth.userId,
    input: body,
  });

  if (error || !row) {
    return NextResponse.json(
      { error: error ?? "update_failed" },
      { status: 400 },
    );
  }
  return NextResponse.json({ quotation: row });
}
