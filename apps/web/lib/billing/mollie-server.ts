import "server-only";

import {
  mollieApiKeyLooksLikeMode,
  mollieBillingSecretsReady,
  mollieConfigFromJson,
  type PlatformMollieConfig,
} from "@/lib/integrations/platform-mollie-config";
import {
  BILLING_ADDONS,
  BILLING_PLANS,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import { mollieAmountEur } from "@/lib/mollie/mollie-amount";
import type { MollieAuth } from "@/lib/mollie/mollie-http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isPlatformIntegrationEnabledAdmin } from "@/lib/supabase/platform-integration-enabled";

export type PlatformMollieBilling = PlatformMollieConfig & {
  enabled: boolean;
};

export async function fetchPlatformMollieBillingAdmin(): Promise<PlatformMollieBilling> {
  const enabled = await isPlatformIntegrationEnabledAdmin("mollie");
  const admin = createSupabaseAdminClient();
  if (!admin) return { enabled: false };
  const { data } = await admin
    .from("platform_integrations")
    .select("config")
    .eq("key", "mollie")
    .maybeSingle();
  const config = mollieConfigFromJson(data?.config);
  return { ...config, enabled };
}

export async function getMollieBillingAuth(): Promise<{
  auth: MollieAuth;
  config: PlatformMollieBilling;
} | null> {
  const config = await fetchPlatformMollieBillingAdmin();
  if (!config.enabled || !mollieBillingSecretsReady(config) || !config.api_key) {
    return null;
  }
  const mode = config.mode ?? "test";
  if (!mollieApiKeyLooksLikeMode(config.api_key, mode)) {
    console.warn("getMollieBillingAuth: api_key passt nicht zu mode", mode);
    return null;
  }
  return {
    auth: { kind: "api_key", apiKey: config.api_key },
    config,
  };
}

/** Yearly catalog prices are per-month; charge the annual total. */
export function billingPlanAmountEuros(
  planId: Exclude<BillingPlanId, "free">,
  interval: BillingInterval,
  includePos: boolean,
): number {
  const plan = BILLING_PLANS[planId];
  let euros =
    interval === "year"
      ? plan.price.yearlyPerMonthEur * 12
      : plan.price.monthlyEur;
  if (includePos) {
    const pos = BILLING_ADDONS.pos.price;
    euros +=
      interval === "year" ? pos.yearlyPerMonthEur * 12 : pos.monthlyEur;
  }
  return Math.round(euros * 100) / 100;
}

export function billingSubscriptionInterval(
  interval: BillingInterval,
): "1 month" | "12 months" {
  return interval === "year" ? "12 months" : "1 month";
}

export function billingSubscriptionDescription(params: {
  planId: Exclude<BillingPlanId, "free">;
  interval: BillingInterval;
  includePos: boolean;
  restaurantName?: string | null;
}): string {
  const planName = BILLING_PLANS[params.planId].name;
  const period = params.interval === "year" ? "jährlich" : "monatlich";
  const pos = params.includePos ? " + POS" : "";
  const name = params.restaurantName?.trim()
    ? ` (${params.restaurantName.trim()})`
    : "";
  return `Gwada ${planName}${pos} — ${period}${name}`;
}

export function mollieBillingAmount(
  planId: Exclude<BillingPlanId, "free">,
  interval: BillingInterval,
  includePos: boolean,
) {
  return mollieAmountEur(
    billingPlanAmountEuros(planId, interval, includePos),
  );
}
