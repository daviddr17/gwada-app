/**
 * NEXT_PUBLIC_* wird beim `next build` eingebettet — Coolify setzt Keys oft erst zur Laufzeit.
 * `GwadaPublicEnvScript` injiziert dieselben Werte aus Server-Env in `window.__GWADA_PUBLIC_ENV__`.
 */

export type GwadaPublicEnv = {
  supabaseAnonKey?: string;
  supabaseProxy?: boolean;
  supabaseUrl?: string;
  siteUrl?: string;
  gwadaSupabaseOnly?: boolean;
  gwadaWorkspaceSlug?: string;
};

declare global {
  interface Window {
    __GWADA_PUBLIC_ENV__?: GwadaPublicEnv;
  }
}

function runtimeEnv(): GwadaPublicEnv | undefined {
  if (typeof window === "undefined") return undefined;
  return window.__GWADA_PUBLIC_ENV__;
}

function envTruthy(v: string | undefined): boolean {
  const t = v?.trim().toLowerCase();
  return t === "true" || t === "1" || t === "yes";
}

export function getSupabaseAnonKey(): string | undefined {
  const injected = runtimeEnv()?.supabaseAnonKey?.trim();
  if (injected) return injected;
  const baked = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return baked || undefined;
}

export function isPublicSupabaseProxyEnabled(): boolean {
  const injected = runtimeEnv()?.supabaseProxy;
  if (injected === true) return true;
  if (injected === false) return false;
  if (envTruthy(process.env.NEXT_PUBLIC_SUPABASE_PROXY)) return true;
  const pub = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (pub?.includes("/sb")) return true;
  const injectedUrl = runtimeEnv()?.supabaseUrl?.trim();
  if (injectedUrl?.includes("/sb")) return true;
  if (typeof window === "undefined" && process.env.NODE_ENV === "production") {
    return Boolean(process.env.SUPABASE_UPSTREAM_URL?.trim());
  }
  return false;
}

export function getPublicSupabaseUrl(): string | undefined {
  const injected = runtimeEnv()?.supabaseUrl?.trim();
  if (injected) return injected.replace(/\/+$/, "");
  const baked = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return baked ? baked.replace(/\/+$/, "") : undefined;
}

export function getPublicSiteUrl(): string | undefined {
  const injected = runtimeEnv()?.siteUrl?.trim();
  if (injected) return injected.replace(/\/+$/, "");
  const baked = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return baked ? baked.replace(/\/+$/, "") : undefined;
}

export function isPublicGwadaSupabaseOnly(): boolean {
  const injected = runtimeEnv()?.gwadaSupabaseOnly;
  if (injected === true) return true;
  if (injected === false) return false;
  return envTruthy(process.env.NEXT_PUBLIC_GWADA_SUPABASE_ONLY);
}

export function getPublicGwadaWorkspaceSlug(): string | undefined {
  const injected = runtimeEnv()?.gwadaWorkspaceSlug?.trim();
  if (injected) return injected;
  const baked = process.env.NEXT_PUBLIC_GWADA_WORKSPACE_SLUG?.trim();
  return baked || undefined;
}

/** Server: Werte für das Inline-Script (nur öffentliche Keys). */
export function buildGwadaPublicEnvForScript(): GwadaPublicEnv {
  const proxyFlag = process.env.NEXT_PUBLIC_SUPABASE_PROXY?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return {
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || undefined,
    supabaseProxy:
      proxyFlag !== undefined
        ? envTruthy(proxyFlag) || supabaseUrl?.includes("/sb") === true
        : supabaseUrl?.includes("/sb") === true ||
          Boolean(process.env.SUPABASE_UPSTREAM_URL?.trim()),
    supabaseUrl: supabaseUrl || undefined,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || undefined,
    gwadaSupabaseOnly: envTruthy(process.env.NEXT_PUBLIC_GWADA_SUPABASE_ONLY),
    gwadaWorkspaceSlug:
      process.env.NEXT_PUBLIC_GWADA_WORKSPACE_SLUG?.trim() || undefined,
  };
}
