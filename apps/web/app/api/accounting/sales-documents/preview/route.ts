import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import { resolveAccountingSalesDocumentDraftPreview } from "@/lib/accounting/accounting-document-server";
import type { AccountingSalesDocumentDraftPreviewInput } from "@/lib/accounting/build-sales-document-preview-row";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    restaurantId?: string;
    kind?: "invoice" | "quotation";
    draft?: AccountingSalesDocumentDraftPreviewInput;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId, "create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!body.draft) {
    return NextResponse.json({ error: "draft_required" }, { status: 400 });
  }

  const kind = body.kind === "quotation" ? "quotation" : "invoice";
  const pdf = await resolveAccountingSalesDocumentDraftPreview(auth.sb, {
    restaurantId: auth.restaurantId,
    kind,
    draft: body.draft,
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
