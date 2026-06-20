import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import { getAccountingVoucher } from "@/lib/accounting/accounting-vouchers-server";
import { ACCOUNTING_VOUCHERS_STORAGE_BUCKET } from "@/lib/accounting/accounting-voucher-storage";
import { getAccountingConnectorForDocument } from "@/lib/accounting/connectors/registry";
import { isExternalAccountingSource } from "@/lib/accounting/accounting-source";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId, "read");
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

  if (isExternalAccountingSource(row.source) && row.external_id) {
    const connector = await getAccountingConnectorForDocument(
      auth.restaurantId,
      row.source,
    );
    if (connector.capabilities.canFetchExternalVoucherFile) {
      const file = await connector.fetchVoucherFile(auth.restaurantId, row);
      if (file?.ok) {
        return new NextResponse(new Uint8Array(file.buffer), {
          headers: {
            "Content-Type": file.contentType,
            "Content-Disposition": `inline; filename="${encodeURIComponent(file.filename)}"`,
          },
        });
      }
      if (file && !file.ok) {
        return NextResponse.json({ error: file.error }, { status: 404 });
      }
    }
  }

  return NextResponse.json({ error: "no_attachment" }, { status: 404 });
}
