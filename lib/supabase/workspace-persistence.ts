import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  GWADA_DB_UNAVAILABLE_MESSAGE,
  isSupabaseOnlyMode,
} from "@/lib/constants/database-mode";

/** JSON-serializable value for `jsonb` columns (no `Json` export in this supabase-js version). */
export type WorkspaceJson =
  | string
  | number
  | boolean
  | null
  | WorkspaceJson[]
  | { [key: string]: WorkspaceJson };

/** True in the browser when public Supabase env is set (used for remote JSON sync). */
export function workspacePersistenceConfigured(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

function workspaceSlug(): string {
  return (process.env.NEXT_PUBLIC_GWADA_WORKSPACE_SLUG || "gwada-demo").trim();
}

/** Cache key = auth user id, or `__anon__` for unauthenticated clients. */
let workspaceRestaurantCache: { key: string; id: string | null } | null = null;

/** Laufender Resolve — wird nach Abschluss geleert, damit bei vorübergehendem Fehler erneut versucht wird. */
let restaurantIdInFlight: Promise<string | null> | null = null;

export const GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT =
  "gwada:workspace-restaurant-changed";

export function notifyWorkspaceRestaurantChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT));
}

export function invalidateWorkspaceRestaurantCache(): void {
  workspaceRestaurantCache = null;
  restaurantIdInFlight = null;
}

export async function getWorkspaceRestaurantId(): Promise<string | null> {
  if (!workspacePersistenceConfigured()) return null;

  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cacheKey = user?.id ?? "__anon__";

  if (workspaceRestaurantCache?.key === cacheKey) {
    return workspaceRestaurantCache.id;
  }

  if (!restaurantIdInFlight) {
    restaurantIdInFlight = (async () => {
      try {
        let id: string | null = null;

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
              id = rid;
            }
          }
          if (!id) {
            const { data: first, error: empErr } = await supabase
              .from("restaurant_employees")
              .select("restaurant_id")
              .eq("profile_id", user.id)
              .eq("is_active", true)
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle();
            if (!empErr && first?.restaurant_id) {
              id = first.restaurant_id;
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
            id = data.id;
          } else {
            console.warn(
              "[gwada] Kein Restaurant mit slug",
              JSON.stringify(workspaceSlug()),
              "— Sync zu Supabase ausgesetzt. Seed ausführen (npm run db:reset) oder NEXT_PUBLIC_GWADA_WORKSPACE_SLUG prüfen.",
            );
          }
        }

        workspaceRestaurantCache = { key: cacheKey, id };
        return id;
      } catch (e) {
        console.warn("[gwada] workspace restaurant", e);
        workspaceRestaurantCache = { key: cacheKey, id: null };
        return null;
      } finally {
        restaurantIdInFlight = null;
      }
    })();
  }

  return restaurantIdInFlight;
}

export async function loadWorkspaceJson(
  storageKey: string,
): Promise<unknown | null> {
  if (!workspacePersistenceConfigured()) return null;
  try {
    const supabase = createSupabaseBrowserClient();
    const restaurantId = await getWorkspaceRestaurantId();
    if (!restaurantId) return null;
    const { data, error } = await supabase
      .from("restaurant_app_state")
      .select("payload")
      .eq("restaurant_id", restaurantId)
      .eq("storage_key", storageKey)
      .maybeSingle();
    if (error || !data) return null;
    return data.payload as unknown;
  } catch (e) {
    console.warn("[gwada] loadWorkspaceJson", storageKey, e);
    return null;
  }
}

export async function saveWorkspaceJson(
  storageKey: string,
  payload: WorkspaceJson,
): Promise<boolean> {
  if (!workspacePersistenceConfigured()) return false;
  try {
    const supabase = createSupabaseBrowserClient();
    const restaurantId = await getWorkspaceRestaurantId();
    if (!restaurantId) return false;
    const { error } = await supabase.from("restaurant_app_state").upsert(
      {
        restaurant_id: restaurantId,
        storage_key: storageKey,
        payload,
      },
      { onConflict: "restaurant_id,storage_key" },
    );
    if (error) {
      console.warn("[gwada] saveWorkspaceJson", storageKey, error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[gwada] saveWorkspaceJson", storageKey, e);
    return false;
  }
}

export function toWorkspaceJson(value: unknown): WorkspaceJson {
  return JSON.parse(JSON.stringify(value)) as WorkspaceJson;
}

/**
 * Speichert App-State: Supabase-only → nur DB.
 * Hybrid: wenn NEXT_PUBLIC_SUPABASE_* gesetzt ist, zuerst DB (`restaurant_app_state`), danach
 * localStorage — damit ein Erfolg in der UI auch wirklich in der DB ankommt (kein „fire-and-forget“-Mirror).
 * Ohne Supabase-Env: nur localStorage.
 */
export async function persistWorkspaceState(
  storageKey: string,
  value: unknown,
): Promise<boolean> {
  if (isSupabaseOnlyMode()) {
    return saveWorkspaceJson(storageKey, toWorkspaceJson(value));
  }
  const json = JSON.stringify(value);
  if (workspacePersistenceConfigured()) {
    const remoteOk = await saveWorkspaceJson(
      storageKey,
      toWorkspaceJson(value),
    );
    if (!remoteOk) {
      return false;
    }
  }
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(storageKey, json);
    }
    return true;
  } catch {
    return false;
  }
}

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
    const slug = workspaceSlug();
    const { data, error } = await supabase
      .from("restaurants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error) {
      return {
        ok: false,
        message: `${GWADA_DB_UNAVAILABLE_MESSAGE} (${error.message})`,
      };
    }
    if (!data?.id) {
      return {
        ok: false,
        message: `${GWADA_DB_UNAVAILABLE_MESSAGE} (Kein Restaurant mit Slug „${slug}“. Bitte „npm run db:reset“ ausführen.)`,
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
