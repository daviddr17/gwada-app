"use client";

import {
  type AppLocale,
  normalizeAppLocale,
} from "@/i18n/config";
import { writeAppLocaleCookie } from "@/i18n/locale-cookie";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { workspacePersistenceConfigured } from "@/lib/supabase/workspace-persistence";

export type ApplyAppLocaleResult =
  | { ok: true; locale: AppLocale }
  | { ok: false; locale: AppLocale; error: string };

/**
 * Persist UI locale via API (Set-Cookie + `profiles.locale`).
 * Caller should `router.refresh()` after success so RSC messages reload.
 */
export async function applyAppLocale(
  nextLocale: string,
): Promise<ApplyAppLocaleResult> {
  const locale = normalizeAppLocale(nextLocale);

  try {
    const res = await fetch("/api/profile/locale", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
      credentials: "same-origin",
    });

    if (res.ok) {
      // Mirror for client reads; server Set-Cookie is source of truth for RSC.
      writeAppLocaleCookie(locale);
      return { ok: true, locale };
    }

    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    return {
      ok: false,
      locale,
      error: body?.error || `http_${res.status}`,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    return { ok: false, locale, error: message };
  }
}

/** Read `profiles.locale` for the signed-in user (null if unavailable). */
export async function fetchProfileAppLocale(): Promise<AppLocale | null> {
  if (!workspacePersistenceConfigured()) return null;
  try {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("locale")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !data?.locale) return null;
    // Legacy column default `fr-GP` predates UI i18n — treat as unset.
    if (data.locale === "fr-GP") return null;
    return normalizeAppLocale(data.locale);
  } catch {
    return null;
  }
}
