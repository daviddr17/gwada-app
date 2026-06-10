import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import { getAccountingVoucher } from "@/lib/accounting/accounting-vouchers-server";
import { ACCOUNTING_VOUCHERS_STORAGE_BUCKET } from "@/lib/accounting/accounting-voucher-storage";
import { fetchLexofficeBookkeepingVoucherFile } from "@/lib/integrations/lexoffice-bookkeeping-vouchers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const row = await getAccountingVoucher(auth.sb, auth.restaurantId, id);
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (row.storage_path) {
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
    }
    const { data, error } = await admin.storage
      .from(ACCOUNTING_VOUCHERS_STORAGE_BUCKET)
      .download(row.storage_path);
    if (error || !data) {
      return NextResponse.json({ error: "file_not_found" }, { status: 404 });
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": row.mime_type ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(row.file_name ?? "beleg")}"`,
      },
    });
  }

  if (row.source === "lexoffice" && row.external_id) {
    const file = await fetchLexofficeBookkeepingVoucherFile(
      auth.restaurantId,
      row.external_id,
    );
    if (!file.ok) {
      return NextResponse.json({ error: file.error }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.filename)}"`,
      },
    });
  }

  return NextResponse.json({ error: "no_attachment" }, { status: 404 });
}
