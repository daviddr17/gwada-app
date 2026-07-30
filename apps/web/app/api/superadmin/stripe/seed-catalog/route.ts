import { seedStripeBillingCatalog } from "@/lib/billing/seed-stripe-catalog";
import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";

export const dynamic = "force-dynamic";

/**
 * Superadmin: Products/Prices/Portal/Webhook für den aktiven Stripe-Modus anlegen.
 * Test-Keys → Sandbox; Live-Keys → Production-Katalog.
 */
export async function POST(req: Request) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    mode?: "test" | "live";
    secretKey?: string;
    webhookBaseUrl?: string;
  };

  const origin = new URL(req.url).origin;
  const webhookBaseUrl = body.webhookBaseUrl?.trim() || origin;

  const result = await seedStripeBillingCatalog({
    webhookBaseUrl,
    mode: body.mode === "live" ? "live" : body.mode === "test" ? "test" : undefined,
    secretKey: body.secretKey?.trim() || undefined,
  });

  if (!result.ok) {
    const status =
      result.error === "secret_key_missing" ||
      result.error === "secret_key_not_test" ||
      result.error === "secret_key_not_live"
        ? 400
        : 500;
    return Response.json({ error: result.error }, { status });
  }

  return Response.json({ ok: true, ...result.result });
}
