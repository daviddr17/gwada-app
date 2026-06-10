import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import { sendSalesDocument } from "@/lib/accounting/accounting-document-server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    restaurantId?: string;
    sendEmail?: boolean;
    sendWhatsapp?: boolean;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await sendSalesDocument(auth.sb, {
    restaurantId: auth.restaurantId,
    kind: "invoice",
    documentId: id,
    userId: auth.userId,
    sendEmail: body.sendEmail === true,
    sendWhatsapp: body.sendWhatsapp === true,
  });

  if (!result.channels.length) {
    return NextResponse.json(
      { error: result.error ?? "send_failed" },
      { status: 400 },
    );
  }

  return NextResponse.json({ channels: result.channels });
}
