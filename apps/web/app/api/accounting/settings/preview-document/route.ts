import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import { resolveAccountingDocumentDesignPreview } from "@/lib/accounting/accounting-document-server";
import type { AccountingDocumentDesign } from "@/lib/types/accounting-settings";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    restaurantId?: string;
    kind?: "invoice" | "quotation";
    documentDesign?: AccountingDocumentDesign;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId, "create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!body.documentDesign) {
    return NextResponse.json({ error: "document_design_required" }, { status: 400 });
  }

  const kind = body.kind === "quotation" ? "quotation" : "invoice";
  const pdf = await resolveAccountingDocumentDesignPreview(auth.sb, {
    restaurantId: auth.restaurantId,
    kind,
    documentDesign: body.documentDesign,
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
