"use client";

import {
  applyUiDensityToDocument,
  normalizeUiDensity,
  type UiDensity,
  writeUiDensityCookie,
} from "@/lib/ui/ui-density";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { workspacePersistenceConfigured } from "@/lib/supabase/workspace-persistence";

export type ApplyUiDensityResult =
  | { ok: true; density: UiDensity }
  | { ok: false; density: UiDensity; error: string };

/**
 * Persist UI density via API (Set-Cookie + `profiles.ui_density`) and apply locally.
 */
export async function applyUiDensity(
  nextDensity: string,
): Promise<ApplyUiDensityResult> {
  const density = normalizeUiDensity(nextDensity);
  applyUiDensityToDocument(density);

  try {
    const res = await fetch("/api/profile/ui-density", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ density }),
      credentials: "same-origin",
    });

    if (res.ok) {
      writeUiDensityCookie(density);
      return { ok: true, density };
    }

    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    return {
      ok: false,
      density,
      error: body?.error || `http_${res.status}`,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    return { ok: false, density, error: message };
  }
}

/** Read `profiles.ui_density` for the signed-in user (null if unavailable). */
export async function fetchProfileUiDensity(): Promise<UiDensity | null> {
  if (!workspacePersistenceConfigured()) return null;
  try {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("ui_density")
      .eq("id", user.id)
      .maybeSingle();

    if (error || data?.ui_density == null) return null;
    if (typeof data.ui_density !== "string") return null;
    return normalizeUiDensity(data.ui_density);
  } catch {
    return null;
  }
}
