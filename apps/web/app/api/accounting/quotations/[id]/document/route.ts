import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import { resolveSalesDocumentPdf } from "@/lib/accounting/accounting-document-server";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId, "read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const pdf = await resolveSalesDocumentPdf(auth.sb, {
    restaurantId: auth.restaurantId,
    kind: "quotation",
    documentId: id,
  });

  if (!pdf.ok) {
    return NextResponse.json({ error: pdf.error }, { status: 400 });
  }

  return new NextResponse(new Uint8Array(pdf.buffer), {
    headers: {
      "Content-Type": pdf.contentType,
      "Content-Disposition": `inline; filename="${pdf.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
