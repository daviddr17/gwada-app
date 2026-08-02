import "server-only";

import Stripe from "stripe";
import {
  resolveActiveStripeProfile,
  stripeKeyLooksLikeMode,
  stripePriceIdForSlot,
  type PlatformStripeConfig,
  type StripePriceSlot,
} from "@/lib/integrations/platform-stripe-config";
import {
  fetchPlatformStripeConfigAdmin,
  type PlatformStripeSecrets,
} from "@/lib/supabase/platform-stripe-secrets-db";
import type { BillingInterval, BillingPlanId } from "@/lib/billing/plan-catalog";

export async function getStripePlatform(): Promise<PlatformStripeSecrets> {
  return fetchPlatformStripeConfigAdmin();
}

export async function createStripeClient(): Promise<{
  stripe: Stripe;
  config: PlatformStripeSecrets;
} | null> {
  const config = await fetchPlatformStripeConfigAdmin();
  const active = resolveActiveStripeProfile(config);
  if (!config.enabled || !active.secret_key) return null;
  if (!stripeKeyLooksLikeMode(active.secret_key, active.mode)) {
    console.warn(
      "createStripeClient: secret_key passt nicht zu mode",
      active.mode,
    );
    return null;
  }
  const stripe = new Stripe(active.secret_key, {
    apiVersion: "2026-07-29.dahlia",
    typescript: true,
  });
  return {
    stripe,
    config: {
      ...config,
      ...active,
      enabled: config.enabled,
    },
  };
}

export function planPriceSlot(
  planId: Exclude<BillingPlanId, "free">,
  interval: BillingInterval,
): StripePriceSlot {
  return `${planId}_${interval === "year" ? "year" : "month"}`;
}

export function posPriceSlot(interval: BillingInterval): StripePriceSlot {
  return interval === "year" ? "pos_year" : "pos_month";
}

export function resolvePriceId(
  config: PlatformStripeConfig,
  slot: StripePriceSlot,
): string | null {
  return stripePriceIdForSlot(config, slot);
}

export function planIdFromPriceId(
  config: PlatformStripeConfig,
  priceId: string,
): BillingPlanId | null {
  const map: Record<string, BillingPlanId> = {};
  const bm = stripePriceIdForSlot(config, "basic_month");
  const by = stripePriceIdForSlot(config, "basic_year");
  const pm = stripePriceIdForSlot(config, "pro_month");
  const py = stripePriceIdForSlot(config, "pro_year");
  if (bm) map[bm] = "basic";
  if (by) map[by] = "basic";
  if (pm) map[pm] = "pro";
  if (py) map[py] = "pro";
  return map[priceId] ?? null;
}

export function intervalFromPriceId(
  config: PlatformStripeConfig,
  priceId: string,
): BillingInterval | null {
  const yearly = new Set(
    [
      stripePriceIdForSlot(config, "basic_year"),
      stripePriceIdForSlot(config, "pro_year"),
      stripePriceIdForSlot(config, "pos_year"),
    ].filter(Boolean),
  );
  const monthly = new Set(
    [
      stripePriceIdForSlot(config, "basic_month"),
      stripePriceIdForSlot(config, "pro_month"),
      stripePriceIdForSlot(config, "pos_month"),
    ].filter(Boolean),
  );
  if (yearly.has(priceId)) return "year";
  if (monthly.has(priceId)) return "month";
  return null;
}

export function isPosPriceId(
  config: PlatformStripeConfig,
  priceId: string,
): boolean {
  return (
    priceId === stripePriceIdForSlot(config, "pos_month") ||
    priceId === stripePriceIdForSlot(config, "pos_year")
  );
}
