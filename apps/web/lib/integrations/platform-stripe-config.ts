export type StripeBillingMode = "test" | "live";

/** Price-IDs + Secrets für genau einen Stripe-Modus (Test oder Live). */
export type PlatformStripeProfile = {
  publishable_key?: string;
  secret_key?: string;
  webhook_secret?: string;
  price_basic_monthly?: string;
  price_basic_yearly?: string;
  price_pro_monthly?: string;
  price_pro_yearly?: string;
  price_pos_monthly?: string;
  price_pos_yearly?: string;
  product_basic?: string;
  product_pro?: string;
  product_pos?: string;
  webhook_endpoint_id?: string;
  portal_configuration_id?: string;
};

export type PlatformStripeConfig = {
  /** Welches Profil diese Umgebung nutzt (Dev → test, Live → live). */
  mode?: StripeBillingMode;
  /** Flat fields = aktives Profil (Backward-Compat / schnelles Lesen). */
  publishable_key?: string;
  secret_key?: string;
  webhook_secret?: string;
  price_basic_monthly?: string;
  price_basic_yearly?: string;
  price_pro_monthly?: string;
  price_pro_yearly?: string;
  price_pos_monthly?: string;
  price_pos_yearly?: string;
  product_basic?: string;
  product_pro?: string;
  product_pos?: string;
  webhook_endpoint_id?: string;
  portal_configuration_id?: string;
  /** Getrennte Sandbox- (Test-) Credentials & Prices. */
  test?: PlatformStripeProfile;
  /** Getrennte Live-Credentials & Prices. */
  live?: PlatformStripeProfile;
};

export type PlatformStripeProfileUi = {
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

export type PlatformStripeConfigUi = {
  mode?: StripeBillingMode;
  publishable_key?: string;
  secret_key_configured?: boolean;
  webhook_secret_configured?: boolean;
  price_basic_monthly?: string;
  price_basic_yearly?: string;
  price_pro_monthly?: string;
  price_pro_yearly?: string;
  price_pos_monthly?: string;
  price_pos_yearly?: string;
  test?: PlatformStripeProfileUi;
  live?: PlatformStripeProfileUi;
};

function str(o: Record<string, unknown>, k: string): string | undefined {
  return typeof o[k] === "string"
    ? (o[k] as string).trim() || undefined
    : undefined;
}

function profileFromJson(raw: unknown): PlatformStripeProfile {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  return {
    publishable_key: str(o, "publishable_key"),
    secret_key: str(o, "secret_key"),
    webhook_secret: str(o, "webhook_secret"),
    price_basic_monthly: str(o, "price_basic_monthly"),
    price_basic_yearly: str(o, "price_basic_yearly"),
    price_pro_monthly: str(o, "price_pro_monthly"),
    price_pro_yearly: str(o, "price_pro_yearly"),
    price_pos_monthly: str(o, "price_pos_monthly"),
    price_pos_yearly: str(o, "price_pos_yearly"),
    product_basic: str(o, "product_basic"),
    product_pro: str(o, "product_pro"),
    product_pos: str(o, "product_pos"),
    webhook_endpoint_id: str(o, "webhook_endpoint_id"),
    portal_configuration_id: str(o, "portal_configuration_id"),
  };
}

function profileToUi(profile: PlatformStripeProfile): PlatformStripeProfileUi {
  return {
    publishable_key: profile.publishable_key,
    secret_key_configured: Boolean(profile.secret_key?.length),
    webhook_secret_configured: Boolean(profile.webhook_secret?.length),
    price_basic_monthly: profile.price_basic_monthly,
    price_basic_yearly: profile.price_basic_yearly,
    price_pro_monthly: profile.price_pro_monthly,
    price_pro_yearly: profile.price_pro_yearly,
    price_pos_monthly: profile.price_pos_monthly,
    price_pos_yearly: profile.price_pos_yearly,
  };
}

function flatFromConfig(config: PlatformStripeConfig): PlatformStripeProfile {
  return {
    publishable_key: config.publishable_key,
    secret_key: config.secret_key,
    webhook_secret: config.webhook_secret,
    price_basic_monthly: config.price_basic_monthly,
    price_basic_yearly: config.price_basic_yearly,
    price_pro_monthly: config.price_pro_monthly,
    price_pro_yearly: config.price_pro_yearly,
    price_pos_monthly: config.price_pos_monthly,
    price_pos_yearly: config.price_pos_yearly,
    product_basic: config.product_basic,
    product_pro: config.product_pro,
    product_pos: config.product_pos,
    webhook_endpoint_id: config.webhook_endpoint_id,
    portal_configuration_id: config.portal_configuration_id,
  };
}

function applyFlat(
  target: PlatformStripeConfig,
  profile: PlatformStripeProfile,
): void {
  target.publishable_key = profile.publishable_key;
  target.secret_key = profile.secret_key;
  target.webhook_secret = profile.webhook_secret;
  target.price_basic_monthly = profile.price_basic_monthly;
  target.price_basic_yearly = profile.price_basic_yearly;
  target.price_pro_monthly = profile.price_pro_monthly;
  target.price_pro_yearly = profile.price_pro_yearly;
  target.price_pos_monthly = profile.price_pos_monthly;
  target.price_pos_yearly = profile.price_pos_yearly;
  target.product_basic = profile.product_basic;
  target.product_pro = profile.product_pro;
  target.product_pos = profile.product_pos;
  target.webhook_endpoint_id = profile.webhook_endpoint_id;
  target.portal_configuration_id = profile.portal_configuration_id;
}

export function stripeConfigFromJson(raw: unknown): PlatformStripeConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const modeRaw = str(o, "mode");
  const mode: StripeBillingMode | undefined =
    modeRaw === "live" ? "live" : modeRaw === "test" ? "test" : undefined;

  const flat = profileFromJson(o);
  const test = o.test ? profileFromJson(o.test) : undefined;
  const live = o.live ? profileFromJson(o.live) : undefined;

  // Wenn nur Flat-Felder existieren (älterer Stand): als live/test je nach Mode spiegeln
  const inferredLive =
    live && Object.values(live).some(Boolean)
      ? live
      : mode === "live" || (!mode && flat.secret_key?.startsWith("sk_live"))
        ? flat
        : live;
  const inferredTest =
    test && Object.values(test).some(Boolean)
      ? test
      : mode === "test" || flat.secret_key?.startsWith("sk_test")
        ? flat
        : test;

  const resolvedMode: StripeBillingMode =
    mode ??
    (flat.secret_key?.startsWith("sk_live") ||
    flat.secret_key?.startsWith("rk_live")
      ? "live"
      : "test");

  const active =
    resolvedMode === "live"
      ? inferredLive && Object.values(inferredLive).some(Boolean)
        ? inferredLive
        : flat
      : inferredTest && Object.values(inferredTest).some(Boolean)
        ? inferredTest
        : flat;

  const out: PlatformStripeConfig = {
    mode: resolvedMode,
    test: inferredTest,
    live: inferredLive,
  };
  applyFlat(out, active);
  return out;
}

function profileHasBillingData(profile: PlatformStripeProfile | undefined): boolean {
  if (!profile) return false;
  return Boolean(
    profile.secret_key ||
      profile.price_basic_monthly ||
      profile.price_pro_monthly ||
      profile.price_pos_monthly ||
      profile.publishable_key ||
      profile.webhook_secret,
  );
}

/** Aktives Profil (nach mode). Kein Vermischen von Live-Prices in Test. */
export function resolveActiveStripeProfile(
  config: PlatformStripeConfig,
): PlatformStripeProfile & { mode: StripeBillingMode } {
  const mode: StripeBillingMode = config.mode === "live" ? "live" : "test";
  const nested = mode === "live" ? config.live : config.test;
  if (profileHasBillingData(nested)) {
    return { ...nested!, mode };
  }
  const flat = flatFromConfig(config);
  if (profileHasBillingData(flat)) {
    const key = flat.secret_key ?? "";
    const flatLooksLive =
      key.startsWith("sk_live_") || key.startsWith("rk_live_");
    const flatLooksTest =
      key.startsWith("sk_test_") || key.startsWith("rk_test_");
    if (!key || (mode === "live" ? !flatLooksTest : !flatLooksLive)) {
      return { ...flat, mode };
    }
  }
  return { mode };
}

export function stripeConfigToUi(
  config: PlatformStripeConfig,
): PlatformStripeConfigUi {
  const parsed = stripeConfigFromJson(config);
  const active = resolveActiveStripeProfile(parsed);
  return {
    mode: active.mode,
    ...profileToUi(active),
    test: parsed.test ? profileToUi(parsed.test) : undefined,
    live: parsed.live ? profileToUi(parsed.live) : undefined,
  };
}

export function mergeStripeSecretFields(
  incoming: {
    secret_key?: string;
    webhook_secret?: string;
  },
  existing: PlatformStripeProfile,
): Pick<PlatformStripeProfile, "secret_key" | "webhook_secret"> {
  return {
    secret_key: incoming.secret_key?.trim() || existing.secret_key,
    webhook_secret: incoming.webhook_secret?.trim() || existing.webhook_secret,
  };
}

/**
 * Merge Superadmin-Save: schreibt ins gewählte mode-Profil und spiegelt Flat.
 * Secrets leer lassen = behalten.
 */
export function mergeStripeConfig(
  existingRaw: unknown,
  incomingRaw: unknown,
): PlatformStripeConfig {
  const existing = stripeConfigFromJson(existingRaw);
  const incoming =
    incomingRaw && typeof incomingRaw === "object" && !Array.isArray(incomingRaw)
      ? (incomingRaw as Record<string, unknown>)
      : {};

  const modeRaw =
    typeof incoming.mode === "string" ? incoming.mode.trim() : undefined;
  const mode: StripeBillingMode =
    modeRaw === "live"
      ? "live"
      : modeRaw === "test"
        ? "test"
        : existing.mode === "live"
          ? "live"
          : "test";

  const existingActive = resolveActiveStripeProfile({ ...existing, mode });
  const secrets = mergeStripeSecretFields(
    {
      secret_key:
        typeof incoming.secret_key === "string"
          ? incoming.secret_key
          : undefined,
      webhook_secret:
        typeof incoming.webhook_secret === "string"
          ? incoming.webhook_secret
          : undefined,
    },
    existingActive,
  );

  const pick = (k: keyof PlatformStripeProfile) => {
    const v = incoming[k];
    if (typeof v === "string") return v.trim() || undefined;
    return existingActive[k];
  };

  const nextProfile: PlatformStripeProfile = {
    publishable_key: pick("publishable_key"),
    secret_key: secrets.secret_key,
    webhook_secret: secrets.webhook_secret,
    price_basic_monthly: pick("price_basic_monthly"),
    price_basic_yearly: pick("price_basic_yearly"),
    price_pro_monthly: pick("price_pro_monthly"),
    price_pro_yearly: pick("price_pro_yearly"),
    price_pos_monthly: pick("price_pos_monthly"),
    price_pos_yearly: pick("price_pos_yearly"),
    product_basic: pick("product_basic"),
    product_pro: pick("product_pro"),
    product_pos: pick("product_pos"),
    webhook_endpoint_id: pick("webhook_endpoint_id"),
    portal_configuration_id: pick("portal_configuration_id"),
  };

  const out: PlatformStripeConfig = {
    mode,
    test: mode === "test" ? nextProfile : existing.test,
    live: mode === "live" ? nextProfile : existing.live,
  };
  // Andere Profil-Seite behalten
  if (mode === "test" && existing.live) out.live = existing.live;
  if (mode === "live" && existing.test) out.test = existing.test;
  applyFlat(out, nextProfile);
  return out;
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
  const active = resolveActiveStripeProfile(config);
  const map: Record<StripePriceSlot, string | undefined> = {
    basic_month: active.price_basic_monthly,
    basic_year: active.price_basic_yearly,
    pro_month: active.price_pro_monthly,
    pro_year: active.price_pro_yearly,
    pos_month: active.price_pos_monthly,
    pos_year: active.price_pos_yearly,
  };
  return map[slot]?.trim() || null;
}

export function stripeKeyLooksLikeMode(
  secretKey: string | undefined,
  mode: StripeBillingMode,
): boolean {
  if (!secretKey) return true;
  if (mode === "test") {
    return (
      secretKey.startsWith("sk_test_") ||
      secretKey.startsWith("rk_test_")
    );
  }
  return (
    secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_")
  );
}
