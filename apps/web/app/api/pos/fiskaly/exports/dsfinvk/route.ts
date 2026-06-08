import type { DsfinvkExportFilter } from "@/lib/pos/fiskaly-dsfinvk-export";
import {
  fetchDsfinvkExportZip,
  triggerDsfinvkExport,
} from "@/lib/pos/fiskaly-dsfinvk-export";
import { authorizePosRestaurantPermission } from "@/lib/pos/pos-route-auth";
import { fetchPlatformFiskalySecretsAdmin } from "@/lib/supabase/platform-fiskaly-secrets-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ExportBody = {
  dateFrom?: string;
  dateTo?: string;
  filter?: DsfinvkExportFilter;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurantId");

  const auth = await authorizePosRestaurantPermission(
    request,
    restaurantId,
    "pos.kasse.export",
  );
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  let body: ExportBody = {};
  try {
    body = (await request.json()) as ExportBody;
  } catch {
    body = {};
  }

  const dateFrom = body.dateFrom?.trim() ?? "";
  const dateTo = body.dateTo?.trim() ?? dateFrom;
  const filter: DsfinvkExportFilter =
    body.filter === "creation" ? "creation" : "business";

  if (!DATE_RE.test(dateFrom) || !DATE_RE.test(dateTo)) {
    return Response.json({ error: "invalid_date_range" }, { status: 400 });
  }

  const platform = await fetchPlatformFiskalySecretsAdmin();
  if (!platform?.enabled || !platform.apiKey || !platform.apiSecret) {
    return Response.json({ error: "fiskaly_not_configured" }, { status: 502 });
  }

  const admin = createSupabaseAdminClient();
  const { data: config } = admin
    ? await admin
        .from("pos_restaurant_fiscal_config")
        .select("fiskaly_client_id")
        .eq("restaurant_id", auth.auth.restaurantId)
        .maybeSingle()
    : { data: null };

  const clientId = config?.fiskaly_client_id?.trim();
  if (!clientId) {
    return Response.json({ error: "fiscal_config_not_found" }, { status: 404 });
  }

  if (filter === "business" && dateFrom === dateTo) {
    const fetched = await fetchDsfinvkExportZip({
      dsfinvkBaseUrl: platform.dsfinvkBaseUrl,
      apiKey: platform.apiKey,
      apiSecret: platform.apiSecret,
      clientId,
      businessDate: dateFrom,
    });
    if (fetched.ok) {
      return new Response(new Uint8Array(fetched.buffer), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="dsfinvk-${dateFrom}.zip"`,
        },
      });
    }
    return Response.json(
      { error: fetched.error, exportId: fetched.exportId },
      { status: 502 },
    );
  }

  const triggered = await triggerDsfinvkExport({
    dsfinvkBaseUrl: platform.dsfinvkBaseUrl,
    apiKey: platform.apiKey,
    apiSecret: platform.apiSecret,
    clientId,
    dateFrom,
    dateTo,
    filter,
  });

  if (!triggered.ok) {
    return Response.json({ error: triggered.error }, { status: 502 });
  }

  return Response.json({
    exportId: triggered.exportId,
    state: triggered.state,
    closingCount: triggered.closingCount,
    ready: triggered.state === "COMPLETED",
  });
}
