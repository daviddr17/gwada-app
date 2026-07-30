export type PlatformStripeConfig = {
  mode?: "test" | "live";
  publishable_key?: string;
  secret_key?: string;
  webhook_secret?: string;
  price_basic_monthly?: string;
  price_basic_yearly?: string;
  price_pro_monthly?: string;
  price_pro_yearly?: string;
  price_pos_monthly?: string;
  price_pos_yearly?: string;
};

export type PlatformStripeConfigUi = {
  mode?: "test" | "live";
  publishable_key?: string;
  secret_key_configured?: boolean;
  webhook_secret_configured?: boolean;
  price_basic_monthly?: string;
  price_basic_yearly?: string;
  price_pro_monthly?: string;
  price_pro_yearly?: string;
  price_pos_monthly?: string;
  price_pos_yearly?: string;
};

function str(o: Record<string, unknown>, k: string): string | undefined {
  return typeof o[k] === "string" ? (o[k] as string).trim() || undefined : undefined;
}

export function stripeConfigFromJson(raw: unknown): PlatformStripeConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const mode = str(o, "mode");
  return {
    mode: mode === "live" ? "live" : mode === "test" ? "test" : undefined,
    publishable_key: str(o, "publishable_key"),
    secret_key: str(o, "secret_key"),
    webhook_secret: str(o, "webhook_secret"),
    price_basic_monthly: str(o, "price_basic_monthly"),
    price_basic_yearly: str(o, "price_basic_yearly"),
    price_pro_monthly: str(o, "price_pro_monthly"),
    price_pro_yearly: str(o, "price_pro_yearly"),
    price_pos_monthly: str(o, "price_pos_monthly"),
    price_pos_yearly: str(o, "price_pos_yearly"),
  };
}

export function stripeConfigToUi(
  config: PlatformStripeConfig,
): PlatformStripeConfigUi {
  return {
    mode: config.mode ?? "test",
    publishable_key: config.publishable_key,
    secret_key_configured: Boolean(config.secret_key?.length),
    webhook_secret_configured: Boolean(config.webhook_secret?.length),
    price_basic_monthly: config.price_basic_monthly,
    price_basic_yearly: config.price_basic_yearly,
    price_pro_monthly: config.price_pro_monthly,
    price_pro_yearly: config.price_pro_yearly,
    price_pos_monthly: config.price_pos_monthly,
    price_pos_yearly: config.price_pos_yearly,
  };
}

export function mergeStripeSecretFields(
  incoming: {
    secret_key?: string;
    webhook_secret?: string;
  },
  existing: PlatformStripeConfig,
): Pick<PlatformStripeConfig, "secret_key" | "webhook_secret"> {
  return {
    secret_key: incoming.secret_key?.trim() || existing.secret_key,
    webhook_secret: incoming.webhook_secret?.trim() || existing.webhook_secret,
  };
}

export type StripePriceSlot =
  | "basic_month"
  | "basic_year"
  | "pro_month"
  | "pro_year"
  | "pos_month"
  | "pos_year";

export function stripePriceIdForSlot(
  config: PlatformStripeConfig,
  slot: StripePriceSlot,
): string | null {
  const map: Record<StripePriceSlot, string | undefined> = {
    basic_month: config.price_basic_monthly,
    basic_year: config.price_basic_yearly,
    pro_month: config.price_pro_monthly,
    pro_year: config.price_pro_yearly,
    pos_month: config.price_pos_monthly,
    pos_year: config.price_pos_yearly,
  };
  return map[slot]?.trim() || null;
}
