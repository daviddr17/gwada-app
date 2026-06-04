"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  mergeRestaurantProfile,
  parsePersistence,
  persistenceStripOpeningHoursForRemote,
} from "@/lib/restaurant/profile-utils";
import { RESTAURANT_STORAGE_KEY } from "@/lib/constants/restaurant-profile";
import { isSupabaseOnlyMode } from "@/lib/constants/database-mode";
import { toastDatabaseSaveError } from "@/lib/supabase/db-toast";
import {
  getWorkspaceRestaurantId,
  GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
  notifyWorkspaceRestaurantChanged,
  peekCachedWorkspaceRestaurantId,
} from "@/lib/supabase/workspace-persistence";
import {
  isUuidRestaurantId,
  loadOpeningHoursForRestaurant,
  openingHoursDbEnabled,
  replaceOpeningHoursForRestaurant,
  weeklyHoursEqualDefault,
} from "@/lib/supabase/opening-hours-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  bindPersistenceToWorkspaceRestaurant,
} from "@/lib/restaurant/workspace-profile-bind";
import { RESTAURANT_SLUG_TAKEN_MESSAGE } from "@/lib/restaurant/restaurant-slug";
import {
  fetchRestaurantProfileImages,
  fetchRestaurantSlug,
  fetchRestaurantStammdatenFromDb,
  syncRestaurantStammdatenToDb,
} from "@/lib/supabase/restaurant-stammdaten-db";
import type {
  RestaurantPersistenceV1,
  RestaurantProfile,
} from "@/lib/types/restaurant";

type RestaurantProfileContextValue = {
  isReady: boolean;
  selectedRestaurantId: string;
  profile: RestaurantProfile;
  /** Stammdaten + Öffnungszeiten für eine beliebige Restaurant-ID (z. B. Workspace-UUID). */
  getProfileForRestaurantId: (id: string) => RestaurantProfile;
  saveProfile: (next: RestaurantProfile) => Promise<boolean>;
  /** Öffnungszeiten: relationale Tabelle `opening_hours` (bei UUID-Restaurant + Supabase). */
  saveOpeningHours: (next: RestaurantProfile) => Promise<boolean>;
  /** Teilupdate im Store (z. B. nach Bild-Upload ohne vollständiges Speichern). */
  patchProfile: (partial: Partial<RestaurantProfile>) => void;
  /** Vorbereitet für Multi-Restaurant; aktuell nur ein Eintrag. */
  setSelectedRestaurantId: (id: string) => void;
};

const RestaurantProfileContext =
  createContext<RestaurantProfileContextValue | null>(null);

function mirrorRestaurantPersistenceLocal(
  persistence: RestaurantPersistenceV1,
): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      RESTAURANT_STORAGE_KEY,
      JSON.stringify(persistenceStripOpeningHoursForRemote(persistence)),
    );
  } catch {
    /* ignore quota */
  }
}

async function loadBoundRestaurantPersistence(): Promise<RestaurantPersistenceV1> {
  const workspaceId = await getWorkspaceRestaurantId();

  if (workspaceId && isUuidRestaurantId(workspaceId)) {
    const sb = createSupabaseBrowserClient();
    const stammdaten = await fetchRestaurantStammdatenFromDb(sb, workspaceId);
    if (stammdaten) {
      const profile = mergeRestaurantProfile(workspaceId, stammdaten);
      const bound: RestaurantPersistenceV1 = {
        version: 1,
        selectedRestaurantId: workspaceId,
        restaurants: { [workspaceId]: profile },
      };
      mirrorRestaurantPersistenceLocal(bound);
      return bound;
    }
  }

  let raw: string | null = null;
  if (typeof localStorage !== "undefined") {
    raw = localStorage.getItem(RESTAURANT_STORAGE_KEY);
  }

  const parsed = parsePersistence(raw);
  return bindPersistenceToWorkspaceRestaurant(parsed, workspaceId);
}

export function RestaurantProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabaseOnly = isSupabaseOnlyMode();

  const [store, setStore] = useState<RestaurantPersistenceV1>(() =>
    parsePersistence(null),
  );
  const [isReady, setIsReady] = useState(false);
  const [workspaceReloadToken, setWorkspaceReloadToken] = useState(0);
  const storeRef = useRef(store);
  storeRef.current = store;

  const applyOpeningHoursOverlay = useCallback(async () => {
    if (!openingHoursDbEnabled()) return;
    const rid = await getWorkspaceRestaurantId();
    if (!rid) return;
    let loaded = await loadOpeningHoursForRestaurant(rid);
    if (!loaded) return;
    if (loaded.wasEmpty) {
      const mem = storeRef.current.restaurants[rid];
      if (
        mem &&
        (!weeklyHoursEqualDefault(mem.weeklyHours) ||
          mem.dateExceptions.length > 0 ||
          mem.kitchenHoursEnabled)
      ) {
        const ok = await replaceOpeningHoursForRestaurant(rid, mem);
        if (!ok.ok) return;
        const again = await loadOpeningHoursForRestaurant(rid);
        if (!again) return;
        loaded = again;
      }
    }
    setStore((prev) => {
      const base =
        prev.restaurants[rid] ?? mergeRestaurantProfile(rid, undefined);
      return {
        ...prev,
        restaurants: {
          ...prev.restaurants,
          [rid]: {
            ...base,
            weeklyHours: loaded.weeklyHours,
            dateExceptions: loaded.dateExceptions,
            kitchenHoursEnabled: loaded.kitchenHoursEnabled,
            kitchenWeeklyHours: loaded.kitchenWeeklyHours,
          },
        },
      };
    });
  }, []);

  useEffect(() => {
    const bump = () => setWorkspaceReloadToken((t) => t + 1);
    window.addEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, bump);
    return () =>
      window.removeEventListener(GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;

    try {
      const raw = localStorage.getItem(RESTAURANT_STORAGE_KEY);
      if (raw) {
        const local = parsePersistence(raw);
        setStore(local);
        setIsReady(true);
      }
    } catch {
      /* ignore quota / private mode */
    }

    void (async () => {
      const bound = await loadBoundRestaurantPersistence();
      if (cancelled) return;
      raf = requestAnimationFrame(() => {
        if (cancelled) return;
        setStore(bound);
        setIsReady(true);
        queueMicrotask(() => {
          void (async () => {
            await applyOpeningHoursOverlay();
            const rid = bound.selectedRestaurantId;
            if (!isUuidRestaurantId(rid)) return;
            const sb = createSupabaseBrowserClient();
            const [slug, images] = await Promise.all([
              fetchRestaurantSlug(sb, rid),
              fetchRestaurantProfileImages(sb, rid),
            ]);
            if (!slug && !images) return;
            setStore((prev) => {
              const p = prev.restaurants[rid];
              if (!p) return prev;
              return {
                ...prev,
                restaurants: {
                  ...prev.restaurants,
                  [rid]: {
                    ...p,
                    ...(slug ? { slug } : {}),
                    ...(images
                      ? {
                          avatarStoragePath: images.avatarStoragePath,
                          coverStoragePath: images.coverStoragePath,
                        }
                      : {}),
                  },
                },
              };
            });
          })();
        });
      });
    })();
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [supabaseOnly, workspaceReloadToken, applyOpeningHoursOverlay]);

  const saveProfile = useCallback(
    (next: RestaurantProfile): Promise<boolean> => {
      const prev = storeRef.current;
      return (async () => {
        const workspaceId = await getWorkspaceRestaurantId();
        const saveId =
          workspaceId && isUuidRestaurantId(workspaceId)
            ? workspaceId
            : next.id;
        const profile: RestaurantProfile = { ...next, id: saveId };
        const n: RestaurantPersistenceV1 = {
          ...prev,
          selectedRestaurantId: saveId,
          restaurants: {
            ...prev.restaurants,
            [saveId]: profile,
          },
        };
        setStore(n);

        mirrorRestaurantPersistenceLocal(n);

        if (isUuidRestaurantId(saveId)) {
          const { ok: synced, error: syncErr } =
            await syncRestaurantStammdatenToDb(
              createSupabaseBrowserClient(),
              profile,
            );
          if (!synced) {
            setStore(prev);
            console.warn("[gwada] syncRestaurantStammdatenToDb", syncErr);
            toast.error(
              syncErr ?? RESTAURANT_SLUG_TAKEN_MESSAGE,
            );
            return false;
          }
        }

        toast.success("Restaurantprofil gespeichert");
        notifyWorkspaceRestaurantChanged();
        return true;
      })();
    },
    [],
  );

  const saveOpeningHours = useCallback(
    async (next: RestaurantProfile): Promise<boolean> => {
      const snapshot = storeRef.current;
      let rid = await getWorkspaceRestaurantId();
      if (!rid) {
        rid = peekCachedWorkspaceRestaurantId();
      }
      const saveId =
        rid && isUuidRestaurantId(rid) ? rid : next.id;
      const profile: RestaurantProfile = { ...next, id: saveId };
      const useDb =
        openingHoursDbEnabled() && rid !== null && isUuidRestaurantId(rid);

      if (openingHoursDbEnabled() && !useDb) {
        toastDatabaseSaveError(
          "Restaurant konnte nicht zugeordnet werden. Bitte Seite neu laden oder erneut anmelden.",
        );
        return false;
      }

      const restaurants: Record<string, RestaurantProfile> = {
        ...snapshot.restaurants,
        [saveId]: profile,
      };
      if (useDb && rid) {
        const base = restaurants[rid] ?? mergeRestaurantProfile(rid, undefined);
        restaurants[rid] = {
          ...base,
          weeklyHours: next.weeklyHours,
          dateExceptions: next.dateExceptions,
          kitchenHoursEnabled: next.kitchenHoursEnabled,
          kitchenWeeklyHours: next.kitchenWeeklyHours,
        };
      }

      setStore((p) => ({ ...p, restaurants }));

      if (useDb && rid) {
        const result = await replaceOpeningHoursForRestaurant(rid, {
          weeklyHours: next.weeklyHours,
          dateExceptions: next.dateExceptions,
          kitchenHoursEnabled: next.kitchenHoursEnabled,
          kitchenWeeklyHours: next.kitchenWeeklyHours,
        });
        if (!result.ok) {
          setStore(snapshot);
          toastDatabaseSaveError(result.error);
          return false;
        }
      }

      const merged: RestaurantPersistenceV1 = {
        ...snapshot,
        selectedRestaurantId: saveId,
        restaurants,
      };

      mirrorRestaurantPersistenceLocal(merged);
      toast.success("Öffnungszeiten gespeichert");
      return true;
    },
    [],
  );

  const patchProfile = useCallback((partial: Partial<RestaurantProfile>) => {
    setStore((prev) => {
      const rid = prev.selectedRestaurantId;
      const p = prev.restaurants[rid];
      if (!p) return prev;
      return {
        ...prev,
        restaurants: {
          ...prev.restaurants,
          [rid]: { ...p, ...partial, id: rid },
        },
      };
    });
  }, []);

  const setSelectedRestaurantId = useCallback(
    (id: string) => {
      const prev = storeRef.current;
      const restaurants = { ...prev.restaurants };
      if (!restaurants[id]) {
        restaurants[id] = mergeRestaurantProfile(id, undefined);
      }
      const n: RestaurantPersistenceV1 = {
        ...prev,
        selectedRestaurantId: id,
        restaurants,
      };
      setStore(n);
      mirrorRestaurantPersistenceLocal(n);
      toast.success("Restaurant-Auswahl gespeichert");
    },
    [],
  );

  const selectedRestaurantId = store.selectedRestaurantId;

  const profile = useMemo(() => {
    const p = store.restaurants[selectedRestaurantId];
    if (p) return p;
    return mergeRestaurantProfile(selectedRestaurantId, undefined);
  }, [store.restaurants, selectedRestaurantId]);

  const getProfileForRestaurantId = useCallback(
    (id: string) => store.restaurants[id] ?? mergeRestaurantProfile(id, undefined),
    [store.restaurants],
  );

  const value = useMemo(
    () => ({
      isReady,
      selectedRestaurantId,
      profile,
      getProfileForRestaurantId,
      saveProfile,
      saveOpeningHours,
      patchProfile,
      setSelectedRestaurantId,
    }),
    [
      isReady,
      selectedRestaurantId,
      profile,
      getProfileForRestaurantId,
      saveProfile,
      saveOpeningHours,
      patchProfile,
      setSelectedRestaurantId,
    ],
  );

  return (
    <RestaurantProfileContext.Provider value={value}>
      {children}
    </RestaurantProfileContext.Provider>
  );
}

export function useRestaurantProfile() {
  const ctx = useContext(RestaurantProfileContext);
  if (!ctx) {
    throw new Error(
      "useRestaurantProfile must be used within RestaurantProfileProvider",
    );
  }
  return ctx;
}
