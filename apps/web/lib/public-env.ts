/** Attribut am `<html>`-Element im Root-Layout (React-19-kompatibel, kein Hydration-Mismatch). */
export const GWADA_PUBLIC_ENV_HTML_ATTR = "data-gwada-public-env";

/**
 * NEXT_PUBLIC_* wird beim `next build` eingebettet — Coolify setzt Keys oft erst zur Laufzeit.
 * Root-Layout legt dieselben Werte als JSON in `data-gwada-public-env` am `<html>` ab.
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

function readPublicEnvFromDom(): GwadaPublicEnv | undefined {
  const raw = document.documentElement
    .getAttribute(GWADA_PUBLIC_ENV_HTML_ATTR)
    ?.trim();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as GwadaPublicEnv;
  } catch {
    return undefined;
  }
}

function runtimeEnv(): GwadaPublicEnv | undefined {
  if (typeof window === "undefined") return undefined;
  if (window.__GWADA_PUBLIC_ENV__) return window.__GWADA_PUBLIC_ENV__;
  const parsed = readPublicEnvFromDom();
  if (parsed) window.__GWADA_PUBLIC_ENV__ = parsed;
  return parsed;
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

function trimOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

/** Server: Werte für das Env-Attribut am `<html>` (nur öffentliche Keys). */
export function buildGwadaPublicEnvForScript(
  requestOrigin?: string | null,
): GwadaPublicEnv {
  const proxyFlag = process.env.NEXT_PUBLIC_SUPABASE_PROXY?.trim();
  const envSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const proxyEnabled =
    proxyFlag !== undefined
      ? envTruthy(proxyFlag) || envSupabaseUrl?.includes("/sb") === true
      : envSupabaseUrl?.includes("/sb") === true ||
        Boolean(process.env.SUPABASE_UPSTREAM_URL?.trim());

  const origin = requestOrigin?.trim() ? trimOrigin(requestOrigin.trim()) : null;
  const siteUrl =
    origin ??
    (envSiteUrl ? trimOrigin(envSiteUrl) : undefined);
  const supabaseUrl =
    origin && proxyEnabled
      ? `${origin}/sb`
      : envSupabaseUrl
        ? trimOrigin(envSupabaseUrl)
        : undefined;

  return {
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || undefined,
    supabaseProxy: proxyEnabled,
    supabaseUrl,
    siteUrl,
    gwadaSupabaseOnly: envTruthy(process.env.NEXT_PUBLIC_GWADA_SUPABASE_ONLY),
    gwadaWorkspaceSlug:
      process.env.NEXT_PUBLIC_GWADA_WORKSPACE_SLUG?.trim() || undefined,
  };
}
