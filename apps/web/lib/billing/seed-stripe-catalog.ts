import "server-only";

import Stripe from "stripe";
import {
  BILLING_ADDONS,
  BILLING_PLANS,
  yearlyTotalEur,
} from "@/lib/billing/plan-catalog";
import {
  mergeStripeConfig,
  resolveActiveStripeProfile,
  stripeConfigFromJson,
  stripeKeyLooksLikeMode,
  type PlatformStripeConfig,
  type StripeBillingMode,
} from "@/lib/integrations/platform-stripe-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchPlatformStripeConfigAdmin } from "@/lib/supabase/platform-stripe-secrets-db";

const LOOKUP = {
  basic_month: "gwada_basic_month",
  basic_year: "gwada_basic_year",
  pro_month: "gwada_pro_month",
  pro_year: "gwada_pro_year",
  pos_month: "gwada_pos_month",
  pos_year: "gwada_pos_year",
} as const;

async function ensureProduct(
  stripe: Stripe,
  opts: {
    name: string;
    description: string;
    plan: string;
    existingId?: string;
  },
): Promise<string> {
  if (opts.existingId) {
    try {
      const existing = await stripe.products.retrieve(opts.existingId);
      if (existing && !existing.deleted) return existing.id;
    } catch {
      /* recreate */
    }
  }

  const listed = await stripe.products.list({ limit: 100, active: true });
  const byMeta = listed.data.find((p) => p.metadata?.gwada_plan === opts.plan);
  if (byMeta) return byMeta.id;

  const created = await stripe.products.create({
    name: opts.name,
    description: opts.description,
    metadata: { gwada_plan: opts.plan, app: "gwada" },
  });
  return created.id;
}

async function ensurePrice(
  stripe: Stripe,
  opts: {
    productId: string;
    unitAmount: number;
    interval: "month" | "year";
    lookupKey: string;
    nickname: string;
    existingId?: string;
  },
): Promise<string> {
  if (opts.existingId) {
    try {
      const existing = await stripe.prices.retrieve(opts.existingId);
      if (existing && existing.active) return existing.id;
    } catch {
      /* recreate */
    }
  }

  try {
    const byLookup = await stripe.prices.list({
      lookup_keys: [opts.lookupKey],
      limit: 1,
      active: true,
    });
    if (byLookup.data[0]) return byLookup.data[0].id;
  } catch {
    /* continue */
  }

  const created = await stripe.prices.create({
    product: opts.productId,
    currency: "eur",
    unit_amount: opts.unitAmount,
    recurring: { interval: opts.interval },
    nickname: opts.nickname,
    lookup_key: opts.lookupKey,
    transfer_lookup_key: true,
    metadata: { gwada_slot: opts.lookupKey, app: "gwada" },
  });
  return created.id;
}

async function ensurePortal(
  stripe: Stripe,
  opts: {
    productBasic: string;
    productPro: string;
    basicPrices: string[];
    proPrices: string[];
    returnUrl: string;
    existingId?: string;
  },
): Promise<string | null> {
  try {
    if (opts.existingId) {
      const existing = await stripe.billingPortal.configurations.retrieve(
        opts.existingId,
      );
      if (existing?.active) return existing.id;
    }
  } catch {
    /* create */
  }

  try {
    const created = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: "Gwada Abo & Abrechnung",
      },
      default_return_url: opts.returnUrl,
      features: {
        customer_update: {
          enabled: true,
          allowed_updates: ["email", "address", "tax_id"],
        },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: {
          enabled: true,
          mode: "at_period_end",
        },
        subscription_update: {
          enabled: true,
          default_allowed_updates: ["price", "promotion_code"],
          proration_behavior: "create_prorations",
          products: [
            { product: opts.productBasic, prices: opts.basicPrices },
            { product: opts.productPro, prices: opts.proPrices },
          ],
        },
      },
    });
    return created.id;
  } catch (err) {
    console.warn(
      "stripe portal seed",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function ensureWebhook(
  stripe: Stripe,
  opts: { url: string; existingId?: string },
): Promise<{ id: string; secret: string | null } | null> {
  if (!opts.url || opts.url.includes("localhost")) {
    return null;
  }

  try {
    const listed = await stripe.webhookEndpoints.list({ limit: 100 });
    const existing = listed.data.find((w) => w.url === opts.url);
    if (existing) {
      return { id: existing.id, secret: null };
    }
  } catch {
    /* create */
  }

  try {
    const created = await stripe.webhookEndpoints.create({
      url: opts.url,
      description: "Gwada SaaS billing",
      enabled_events: [
        "checkout.session.completed",
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "invoice.paid",
        "invoice.payment_failed",
      ],
    });
    return { id: created.id, secret: created.secret ?? null };
  } catch (err) {
    console.warn(
      "stripe webhook seed",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export type SeedStripeCatalogResult = {
  mode: StripeBillingMode;
  prices: Record<string, string>;
  products: Record<string, string>;
  webhookEndpointId: string | null;
  webhookSecretSaved: boolean;
  portalConfigurationId: string | null;
  webhookSkippedLocalhost: boolean;
};

/**
 * Legt Products/Prices/Portal/Webhook im Stripe-Account des aktiven Modus an
 * und schreibt die IDs zurück nach platform_integrations.
 */
export async function seedStripeBillingCatalog(input: {
  webhookBaseUrl: string;
  /** Optional: frischer Secret (sonst aus DB). */
  secretKey?: string;
  mode?: StripeBillingMode;
}): Promise<
  | { ok: true; result: SeedStripeCatalogResult }
  | { ok: false; error: string }
> {
  const current = await fetchPlatformStripeConfigAdmin();
  const mode: StripeBillingMode =
    input.mode ?? (current.mode === "live" ? "live" : "test");
  const active = resolveActiveStripeProfile({ ...current, mode });
  const secretKey = input.secretKey?.trim() || active.secret_key;

  if (!secretKey) {
    return { ok: false, error: "secret_key_missing" };
  }
  if (!stripeKeyLooksLikeMode(secretKey, mode)) {
    return {
      ok: false,
      error:
        mode === "test"
          ? "secret_key_not_test"
          : "secret_key_not_live",
    };
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: "2026-07-29.dahlia",
    typescript: true,
  });

  const basicId = await ensureProduct(stripe, {
    name: `Gwada Basic${mode === "test" ? " (Test)" : ""}`,
    description: BILLING_PLANS.basic.pitch,
    plan: "basic",
    existingId: active.product_basic,
  });
  const proId = await ensureProduct(stripe, {
    name: `Gwada Pro${mode === "test" ? " (Test)" : ""}`,
    description: BILLING_PLANS.pro.pitch,
    plan: "pro",
    existingId: active.product_pro,
  });
  const posId = await ensureProduct(stripe, {
    name: `Gwada POS${mode === "test" ? " (Test)" : ""}`,
    description: BILLING_ADDONS.pos.pitch,
    plan: "pos",
    existingId: active.product_pos,
  });

  const prices = {
    basic_month: await ensurePrice(stripe, {
      productId: basicId,
      unitAmount: BILLING_PLANS.basic.price.monthlyEur * 100,
      interval: "month",
      lookupKey: LOOKUP.basic_month,
      nickname: "Basic monatlich",
      existingId: active.price_basic_monthly,
    }),
    basic_year: await ensurePrice(stripe, {
      productId: basicId,
      unitAmount: yearlyTotalEur(BILLING_PLANS.basic.price) * 100,
      interval: "year",
      lookupKey: LOOKUP.basic_year,
      nickname: "Basic jährlich",
      existingId: active.price_basic_yearly,
    }),
    pro_month: await ensurePrice(stripe, {
      productId: proId,
      unitAmount: BILLING_PLANS.pro.price.monthlyEur * 100,
      interval: "month",
      lookupKey: LOOKUP.pro_month,
      nickname: "Pro monatlich",
      existingId: active.price_pro_monthly,
    }),
    pro_year: await ensurePrice(stripe, {
      productId: proId,
      unitAmount: yearlyTotalEur(BILLING_PLANS.pro.price) * 100,
      interval: "year",
      lookupKey: LOOKUP.pro_year,
      nickname: "Pro jährlich",
      existingId: active.price_pro_yearly,
    }),
    pos_month: await ensurePrice(stripe, {
      productId: posId,
      unitAmount: BILLING_ADDONS.pos.price.monthlyEur * 100,
      interval: "month",
      lookupKey: LOOKUP.pos_month,
      nickname: "POS monatlich",
      existingId: active.price_pos_monthly,
    }),
    pos_year: await ensurePrice(stripe, {
      productId: posId,
      unitAmount: yearlyTotalEur(BILLING_ADDONS.pos.price) * 100,
      interval: "year",
      lookupKey: LOOKUP.pos_year,
      nickname: "POS jährlich",
      existingId: active.price_pos_yearly,
    }),
  };

  const returnUrl = `${input.webhookBaseUrl.replace(/\/$/, "")}/dashboard/settings/abo`;
  const portalId = await ensurePortal(stripe, {
    productBasic: basicId,
    productPro: proId,
    basicPrices: [prices.basic_month, prices.basic_year],
    proPrices: [prices.pro_month, prices.pro_year],
    returnUrl,
    existingId: active.portal_configuration_id,
  });

  const webhookUrl = `${input.webhookBaseUrl.replace(/\/$/, "")}/api/billing/stripe/webhook`;
  const webhookSkippedLocalhost = /localhost|127\.0\.0\.1/.test(webhookUrl);
  const webhook = webhookSkippedLocalhost
    ? null
    : await ensureWebhook(stripe, {
        url: webhookUrl,
        existingId: active.webhook_endpoint_id,
      });

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "server_misconfigured" };

  const { data: row } = await admin
    .from("platform_integrations")
    .select("enabled, config")
    .eq("key", "stripe")
    .maybeSingle();

  const existingConfig = stripeConfigFromJson(row?.config);
  const incoming: Record<string, unknown> = {
    mode,
    secret_key: secretKey,
    price_basic_monthly: prices.basic_month,
    price_basic_yearly: prices.basic_year,
    price_pro_monthly: prices.pro_month,
    price_pro_yearly: prices.pro_year,
    price_pos_monthly: prices.pos_month,
    price_pos_yearly: prices.pos_year,
    product_basic: basicId,
    product_pro: proId,
    product_pos: posId,
  };
  if (portalId) incoming.portal_configuration_id = portalId;
  if (webhook?.id) incoming.webhook_endpoint_id = webhook.id;
  if (webhook?.secret) incoming.webhook_secret = webhook.secret;

  const merged = mergeStripeConfig(existingConfig, incoming) as PlatformStripeConfig;

  const { error } = await admin.from("platform_integrations").upsert({
    key: "stripe",
    enabled: Boolean(row?.enabled),
    config: merged,
  });
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    result: {
      mode,
      prices,
      products: { basic: basicId, pro: proId, pos: posId },
      webhookEndpointId: webhook?.id ?? null,
      webhookSecretSaved: Boolean(webhook?.secret),
      portalConfigurationId: portalId,
      webhookSkippedLocalhost,
    },
  };
}
