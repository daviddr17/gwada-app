import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSiteUrl } from "@/lib/public-env";
import { safeInternalPath } from "@/lib/navigation/safe-internal-path";

export type AdminAuthLinkRewriteOptions = {
  siteUrl?: string | null;
  /** Für GoTrue generateLink (Allow-List). */
  redirectTo?: string | null;
  /** Ziel nach erfolgreicher Auth — App-intern. */
  nextPath?: string | null;
};

type GenerateLinkParams = Parameters<
  SupabaseClient["auth"]["admin"]["generateLink"]
>[0];

function resolveSiteOrigin(options: AdminAuthLinkRewriteOptions): string | null {
  const fromOptions = options.siteUrl?.trim().replace(/\/+$/, "");
  if (fromOptions) return fromOptions;
  const fromEnv = getPublicSiteUrl()?.trim().replace(/\/+$/, "");
  return fromEnv || null;
}

function nextPathFromOptions(
  options: AdminAuthLinkRewriteOptions,
  linkParams: GenerateLinkParams,
): string {
  if (options.nextPath != null) {
    return safeInternalPath(options.nextPath);
  }
  const redirectRaw =
    options.redirectTo?.trim() ||
    (typeof linkParams === "object" &&
    linkParams !== null &&
    "options" in linkParams &&
    linkParams.options &&
    typeof linkParams.options === "object" &&
    "redirectTo" in linkParams.options
      ? String(linkParams.options.redirectTo ?? "")
      : "");
  if (!redirectRaw) return "/dashboard";
  try {
    const next = new URL(redirectRaw).searchParams.get("next");
    return safeInternalPath(next);
  } catch {
    return "/dashboard";
  }
}

/**
 * GoTrue `generateLink` → direkter App-Callback mit `token_hash` (SSR/verifyOtp).
 * Kein Umweg über `/sb/auth/v1/verify` — vermeidet Redirect-/PKCE-Probleme live.
 */
export async function generateAdminAuthActionLink(
  admin: SupabaseClient,
  linkParams: GenerateLinkParams,
  options: AdminAuthLinkRewriteOptions,
): Promise<{ ok: true; actionLink: string } | { ok: false; error: string }> {
  const origin = resolveSiteOrigin(options);
  if (!origin) {
    return { ok: false, error: "site_url_missing" };
  }

  const nextPath = nextPathFromOptions(options, linkParams);
  const redirectTo =
    options.redirectTo?.trim() ||
    `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  const mergedParams = {
    ...linkParams,
    options: {
      ...(typeof linkParams === "object" &&
      linkParams !== null &&
      "options" in linkParams &&
      linkParams.options &&
      typeof linkParams.options === "object"
        ? linkParams.options
        : {}),
      redirectTo,
    },
  } as GenerateLinkParams;

  const { data, error } = await admin.auth.admin.generateLink(mergedParams);
  const tokenHash = data?.properties?.hashed_token?.trim();
  const verificationType = data?.properties?.verification_type;

  if (error || !tokenHash || !verificationType) {
    return { ok: false, error: error?.message ?? "link_generation_failed" };
  }

  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("token_hash", tokenHash);
  callback.searchParams.set("type", verificationType);
  callback.searchParams.set("next", nextPath);

  return {
    ok: true,
    actionLink: callback.toString(),
  };
}
