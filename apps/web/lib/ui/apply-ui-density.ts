"use client";

import {
  applyUiDensityToDocument,
  normalizeUiDensity,
  persistUiDensityLocally,
  readStoredUiDensityClient,
  type UiDensity,
} from "@/lib/ui/ui-density";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { workspacePersistenceConfigured } from "@/lib/supabase/workspace-persistence";

export type ApplyUiDensityResult =
  | { ok: true; density: UiDensity; persisted: "db" | "local" }
  | { ok: false; density: UiDensity; error: string };

/**
 * Always persist locally (cookie + localStorage).
 * DB write is best-effort — missing column must not fail the UX.
 */
export async function applyUiDensity(
  nextDensity: string,
): Promise<ApplyUiDensityResult> {
  const density = normalizeUiDensity(nextDensity);
  persistUiDensityLocally(density);

  try {
    const res = await fetch("/api/profile/ui-density", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ density }),
      credentials: "same-origin",
    });

    if (res.ok) {
      const body = (await res.json().catch(() => null)) as {
        data?: { persisted?: string };
      } | null;
      const persisted =
        body?.data?.persisted === "db" ? ("db" as const) : ("local" as const);
      persistUiDensityLocally(density);
      return { ok: true, density, persisted };
    }

    // API unreachable / unexpected — local already saved.
    return { ok: true, density, persisted: "local" };
  } catch {
    return { ok: true, density, persisted: "local" };
  }
}

/**
 * Prefer DB when column exists; otherwise cookie/localStorage.
 * Never throws; never surfaces missing-column errors.
 */
export async function fetchProfileUiDensity(): Promise<UiDensity | null> {
  const local = readStoredUiDensityClient();

  if (!workspacePersistenceConfigured()) {
    return local;
  }

  try {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return local;

    const { data, error } = await supabase
      .from("profiles")
      .select("ui_density")
      .eq("id", user.id)
      .maybeSingle();

    if (error || data?.ui_density == null) return local;
    if (typeof data.ui_density !== "string") return local;
    return normalizeUiDensity(data.ui_density);
  } catch {
    return local;
  }
}

/** Apply stored local preference immediately (first paint / mount). */
export function hydrateUiDensityFromLocalStore(): UiDensity | null {
  const stored = readStoredUiDensityClient();
  if (stored) applyUiDensityToDocument(stored);
  return stored;
}
