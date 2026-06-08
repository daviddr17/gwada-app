import { downloadDsfinvkExport } from "@/lib/pos/fiskaly-dsfinvk-export";
import { authorizePosRestaurantPermission } from "@/lib/pos/pos-route-auth";
import { fetchPlatformFiskalySecretsAdmin } from "@/lib/supabase/platform-fiskaly-secrets-db";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ exportId: string }> },
) {
  const { exportId } = await context.params;
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

  const platform = await fetchPlatformFiskalySecretsAdmin();
  if (!platform?.enabled || !platform.apiKey || !platform.apiSecret) {
    return Response.json({ error: "fiskaly_not_configured" }, { status: 502 });
  }

  const downloaded = await downloadDsfinvkExport({
    dsfinvkBaseUrl: platform.dsfinvkBaseUrl,
    apiKey: platform.apiKey,
    apiSecret: platform.apiSecret,
    exportId,
  });

  if (!downloaded.ok) {
    return Response.json({ error: downloaded.error }, { status: 502 });
  }

  return new Response(new Uint8Array(downloaded.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="dsfinvk-${exportId}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
