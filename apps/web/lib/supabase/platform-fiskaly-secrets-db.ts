import "server-only";

import { fiskalyConfigFromJson } from "@/lib/integrations/platform-fiskaly-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PlatformFiskalySecrets = {
  enabled: boolean;
  apiKey: string | null;
  apiSecret: string | null;
  signDeBaseUrl: string;
  dsfinvkBaseUrl: string;
  eReceiptBaseUrl: string;
  env: "TEST" | "LIVE";
};

/** Fiskaly platform row — Service Role only. */
export async function fetchPlatformFiskalyConfigAdmin(): Promise<{
  enabled: boolean;
  apiKey: string | null;
  apiSecret: string | null;
  signDeBaseUrl: string;
  dsfinvkBaseUrl: string;
  eReceiptBaseUrl: string;
  env: "TEST" | "LIVE";
}> {
  const sb = createSupabaseAdminClient();
  if (!sb) {
    return {
      enabled: false,
      apiKey: null,
      apiSecret: null,
      signDeBaseUrl: "https://kassensichv-middleware.fiskaly.com/api/v2",
      dsfinvkBaseUrl: "https://dsfinvk.fiskaly.com/api/v1",
      eReceiptBaseUrl: "https://receipt.fiskaly.com/api/v1",
      env: "TEST",
    };
  }

  const { data, error } = await sb
    .from("platform_integrations")
    .select("enabled, config")
    .eq("key", "fiskaly")
    .maybeSingle();

  if (error || !data) {
    console.warn("fetchPlatformFiskalyConfigAdmin", error?.message);
    return {
      enabled: false,
      apiKey: null,
      apiSecret: null,
      signDeBaseUrl: "https://kassensichv-middleware.fiskaly.com/api/v2",
      dsfinvkBaseUrl: "https://dsfinvk.fiskaly.com/api/v1",
      eReceiptBaseUrl: "https://receipt.fiskaly.com/api/v1",
      env: "TEST",
    };
  }

  const cfg = fiskalyConfigFromJson(data.config);
  const apiKey = cfg.api_key?.trim() ?? "";
  const apiSecret = cfg.api_secret?.trim() ?? "";

  return {
    enabled: Boolean(data.enabled),
    apiKey: apiKey || null,
    apiSecret: apiSecret || null,
    signDeBaseUrl:
      cfg.sign_de_base_url ??
      "https://kassensichv-middleware.fiskaly.com/api/v2",
    dsfinvkBaseUrl:
      cfg.dsfinvk_base_url ?? "https://dsfinvk.fiskaly.com/api/v1",
    eReceiptBaseUrl:
      cfg.ereceipt_base_url ?? "https://receipt.fiskaly.com/api/v1",
    env: cfg.env === "LIVE" ? "LIVE" : "TEST",
  };
}

/** Fiskaly API credentials — Service Role only. */
export async function fetchPlatformFiskalySecretsAdmin(): Promise<PlatformFiskalySecrets | null> {
  const platform = await fetchPlatformFiskalyConfigAdmin();
  if (!platform.apiKey || !platform.apiSecret) return null;

  return {
    enabled: platform.enabled,
    apiKey: platform.apiKey,
    apiSecret: platform.apiSecret,
    signDeBaseUrl: platform.signDeBaseUrl,
    dsfinvkBaseUrl: platform.dsfinvkBaseUrl,
    eReceiptBaseUrl: platform.eReceiptBaseUrl,
    env: platform.env,
  };
}
