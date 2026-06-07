import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  GWADA_DB_UNAVAILABLE_MESSAGE,
} from "@/lib/constants/database-mode";
import {
  getPublicGwadaWorkspaceSlug,
  getPublicSupabaseUrl,
  getSupabaseAnonKey,
} from "@/lib/public-env";
import {
  GWADA_SUPABASE_FETCH_TIMEOUT_MS,
  raceWithTimeout,
} from "@/lib/supabase/race-timeout";

/** JSON-serializable value for `jsonb` columns (no `Json` export in this supabase-js version). */
export type WorkspaceJson =
  | string
  | number
  | boolean
  | null
  | WorkspaceJson[]
  | { [key: string]: WorkspaceJson };

/** Env gesetzt — identisch auf Server und Client (für UI/Hydration). */
export function supabasePublicEnvConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

/** True in the browser when public Supabase env is set (used for remote JSON sync). */
export function workspacePersistenceConfigured(): boolean {
  if (typeof window === "undefined") return false;
  return supabasePublicEnvConfigured();
}

function workspaceSlug(): string {
  return (getPublicGwadaWorkspaceSlug() || "gwada-demo").trim();
}

/** Cache key = auth user id, or `__anon__` for unauthenticated clients. */
let workspaceRestaurantCache: { key: string; id: string | null } | null = null;

/** Laufender Resolve — keyed by cacheKey, damit parallele Aufrufer dieselbe Promise teilen. */
let restaurantIdInFlight: {
  key: string;
  promise: Promise<string | null>;
} | null = null;

const SESSION_RESTAURANT_ID_KEY = "gwada:workspace-restaurant-id";
const SESSION_RESTAURANT_USER_KEY = "gwada:workspace-restaurant-user";

export const GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT =
  "gwada:workspace-restaurant-changed";

export function notifyWorkspaceRestaurantChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT));
}

function persistWorkspaceRestaurantIdToSession(
  cacheKey: string,
  id: string | null,
): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (!id) {
      sessionStorage.removeItem(SESSION_RESTAURANT_ID_KEY);
      sessionStorage.removeItem(SESSION_RESTAURANT_USER_KEY);
      return;
    }
    sessionStorage.setItem(SESSION_RESTAURANT_USER_KEY, cacheKey);
    sessionStorage.setItem(SESSION_RESTAURANT_ID_KEY, id);
  } catch {
    /* quota / private mode */
  }
}

function readWorkspaceRestaurantIdFromSession(cacheKey: string): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    if (sessionStorage.getItem(SESSION_RESTAURANT_USER_KEY) !== cacheKey) {
      return null;
    }
    const id = sessionStorage.getItem(SESSION_RESTAURANT_ID_KEY);
    return id && UUID_RE.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function invalidateWorkspaceRestaurantCache(): void {
  workspaceRestaurantCache = null;
  restaurantIdInFlight = null;
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.removeItem(SESSION_RESTAURANT_ID_KEY);
      sessionStorage.removeItem(SESSION_RESTAURANT_USER_KEY);
    } catch {
      /* ignore */
    }
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Synchroner Cache-Hit für sofortige UI (kein „Kein Restaurant“-Flackern beim Navigieren). */
export function peekCachedWorkspaceRestaurantId(): string | null {
  if (typeof window === "undefined") return null;
  if (!workspacePersistenceConfigured()) return null;
  const mem = workspaceRestaurantCache?.id;
  if (mem && UUID_RE.test(mem)) return mem;
  try {
    const id = sessionStorage.getItem(SESSION_RESTAURANT_ID_KEY);
    if (id && UUID_RE.test(id)) {
      const userKey =
        sessionStorage.getItem(SESSION_RESTAURANT_USER_KEY) ?? "__anon__";
      workspaceRestaurantCache = { key: userKey, id };
      return id;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function resolveWorkspaceRestaurantIdFromDb(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  user: User | null,
): Promise<string | null> {
  let resolved: string | null = null;

  if (user) {
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("active_restaurant_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profErr && prof?.active_restaurant_id) {
      const rid = prof.active_restaurant_id;
      const { data: mem } = await supabase
        .from("restaurant_employees")
        .select("restaurant_id")
        .eq("profile_id", user.id)
        .eq("restaurant_id", rid)
        .eq("is_active", true)
        .maybeSingle();
      if (mem?.restaurant_id) {
        resolved = rid;
      }
    }
    if (!resolved) {
      const { data: first, error: empErr } = await supabase
        .from("restaurant_employees")
        .select("restaurant_id")
        .eq("profile_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!empErr && first?.restaurant_id) {
        resolved = first.restaurant_id;
      }
    }
  } else {
    const { data, error } = await supabase
      .from("restaurants")
      .select("id")
      .eq("slug", workspaceSlug())
      .maybeSingle();
    if (error) {
      console.warn("[gwada] workspace restaurant:", error.message);
    } else if (data?.id) {
      resolved = data.id;
    } else {
      console.warn(
        "[gwada] Kein Restaurant mit slug",
        JSON.stringify(workspaceSlug()),
        "— Sync zu Supabase ausgesetzt. Seed ausführen (npm run db:reset) oder NEXT_PUBLIC_GWADA_WORKSPACE_SLUG prüfen.",
      );
    }
  }

  return resolved;
}

async function refreshWorkspaceRestaurantIdInBackground(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  user: User | null,
  cacheKey: string,
  previousId: string | null,
): Promise<void> {
  try {
    const id = await raceWithTimeout(
      resolveWorkspaceRestaurantIdFromDb(supabase, user),
      GWADA_SUPABASE_FETCH_TIMEOUT_MS,
      "Workspace-Restaurant-ID (refresh)",
    );
    if (workspaceRestaurantCache?.key !== cacheKey) return;
    workspaceRestaurantCache = { key: cacheKey, id };
    persistWorkspaceRestaurantIdToSession(cacheKey, id);
    if (id !== previousId) {
      notifyWorkspaceRestaurantChanged();
    }
  } catch (e) {
    console.warn("[gwada] workspace restaurant refresh", e);
  }
}

export async function getWorkspaceRestaurantId(): Promise<string | null> {
  if (!workspacePersistenceConfigured()) return null;

  const supabase = createSupabaseBrowserClient();
  let user: User | null = null;
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    user = sessionData.session?.user ?? null;
  } catch (e) {
    console.warn("[gwada] getSession", e);
    return null;
  }
  const cacheKey = user?.id ?? "__anon__";

  if (workspaceRestaurantCache?.key === cacheKey) {
    return workspaceRestaurantCache.id;
  }

  const fromSession = readWorkspaceRestaurantIdFromSession(cacheKey);
  if (fromSession) {
    workspaceRestaurantCache = { key: cacheKey, id: fromSession };
    void refreshWorkspaceRestaurantIdInBackground(
      supabase,
      user,
      cacheKey,
      fromSession,
    );
    return fromSession;
  }

  if (restaurantIdInFlight?.key === cacheKey) {
    return restaurantIdInFlight.promise;
  }

  const promise = (async (): Promise<string | null> => {
    try {
      const id = await raceWithTimeout(
        resolveWorkspaceRestaurantIdFromDb(supabase, user),
        GWADA_SUPABASE_FETCH_TIMEOUT_MS,
        "Workspace-Restaurant-ID",
      );

      workspaceRestaurantCache = { key: cacheKey, id };
      persistWorkspaceRestaurantIdToSession(cacheKey, id);
      return id;
    } catch (e) {
      console.warn("[gwada] workspace restaurant", e);
      workspaceRestaurantCache = { key: cacheKey, id: null };
      return null;
    } finally {
      if (restaurantIdInFlight?.key === cacheKey) {
        restaurantIdInFlight = null;
      }
    }
  })();

  restaurantIdInFlight = { key: cacheKey, promise };
  return promise;
}

/** Liest JSON nur aus localStorage (Hybrid ohne `restaurant_app_state`). */
export function loadWorkspaceJsonLocal(storageKey: string): unknown | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Schreibt JSON nur in localStorage. */
export function mirrorWorkspaceJsonLocal(
  storageKey: string,
  value: unknown,
): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Prüft, ob die Supabase-API erreichbar ist und `anon` publizierte Restaurants lesen darf (RLS).
 * Kein Slug-Zwang — vermeidet falsche „DB nicht erreichbar“-Meldungen auf `/login`.
 */
export async function checkWorkspaceDatabaseReachable(): Promise<{
  ok: boolean;
  message: string;
}> {
  if (!workspacePersistenceConfigured()) {
    return {
      ok: false,
      message: `${GWADA_DB_UNAVAILABLE_MESSAGE} (Umgebungsvariablen NEXT_PUBLIC_SUPABASE_* fehlen.)`,
    };
  }
  try {
    const supabase = createSupabaseBrowserClient();
    /* Vor Login: anon darf nur `is_published` sehen — Slug-Check schlägt sonst oft fehl
       (falscher Slug / noch kein Seed). Ein lesbarer Demo-Row reicht als „API+DB ok“. */
    const { error } = await raceWithTimeout(
      supabase
        .from("restaurants")
        .select("id")
        .eq("is_published", true)
        .limit(1),
      GWADA_SUPABASE_FETCH_TIMEOUT_MS,
      "Supabase-Restaurants",
    );
    if (error) {
      return {
        ok: false,
        message: `${GWADA_DB_UNAVAILABLE_MESSAGE} (${error.message})`,
      };
    }
    return { ok: true, message: "" };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: `${GWADA_DB_UNAVAILABLE_MESSAGE} (${detail})`,
    };
  }
}
