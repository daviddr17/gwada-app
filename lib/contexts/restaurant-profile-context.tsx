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
import { toastStorageError } from "@/lib/persist-notify";
import { toastDatabaseUnavailable } from "@/lib/supabase/db-toast";
import {
  getWorkspaceRestaurantId,
  GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
  loadWorkspaceJson,
  persistWorkspaceState,
} from "@/lib/supabase/workspace-persistence";
import {
  isUuidRestaurantId,
  loadOpeningHoursForRestaurant,
  openingHoursDbEnabled,
  replaceOpeningHoursForRestaurant,
  weeklyHoursEqualDefault,
} from "@/lib/supabase/opening-hours-db";
import type {
  RestaurantPersistenceV1,
  RestaurantProfile,
} from "@/lib/types/restaurant";

type RestaurantProfileContextValue = {
  isReady: boolean;
  selectedRestaurantId: string;
  profile: RestaurantProfile;
  saveProfile: (next: RestaurantProfile) => void;
  /** Öffnungszeiten: relationale Tabelle `opening_hours` (bei UUID-Restaurant + Supabase). */
  saveOpeningHours: (next: RestaurantProfile) => Promise<boolean>;
  /** Vorbereitet für Multi-Restaurant; aktuell nur ein Eintrag. */
  setSelectedRestaurantId: (id: string) => void;
};

const RestaurantProfileContext =
  createContext<RestaurantProfileContextValue | null>(null);

export function RestaurantProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabaseOnly = isSupabaseOnlyMode();
  const failSave = supabaseOnly ? toastDatabaseUnavailable : toastStorageError;

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
          mem.dateExceptions.length > 0)
      ) {
        const ok = await replaceOpeningHoursForRestaurant(rid, mem);
        if (!ok) return;
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

    if (supabaseOnly) {
      void (async () => {
        const remote = await loadWorkspaceJson(RESTAURANT_STORAGE_KEY);
        if (cancelled) return;
        const raw =
          remote && typeof remote === "object" && !Array.isArray(remote)
            ? JSON.stringify(remote)
            : null;
        setStore(parsePersistence(raw));
        setIsReady(true);
        queueMicrotask(() => {
          void applyOpeningHoursOverlay();
        });
      })();
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const remote = await loadWorkspaceJson(RESTAURANT_STORAGE_KEY);
      let raw: string | null = null;
      if (remote && typeof remote === "object" && !Array.isArray(remote)) {
        try {
          raw = JSON.stringify(remote);
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(RESTAURANT_STORAGE_KEY, raw);
          }
        } catch {
          raw = null;
        }
      }
      if (cancelled) return;
      const fromLocal =
        typeof localStorage !== "undefined"
          ? localStorage.getItem(RESTAURANT_STORAGE_KEY)
          : null;
      raf = requestAnimationFrame(() => {
        if (cancelled) return;
        setStore(parsePersistence(raw ?? fromLocal));
        setIsReady(true);
        queueMicrotask(() => {
          void applyOpeningHoursOverlay();
        });
      });
    })();
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [supabaseOnly, workspaceReloadToken, applyOpeningHoursOverlay]);

  const saveProfile = useCallback(
    (next: RestaurantProfile) => {
      setStore((prev) => {
        const n: RestaurantPersistenceV1 = {
          ...prev,
          restaurants: {
            ...prev.restaurants,
            [next.id]: next,
          },
        };
        void persistWorkspaceState(
          RESTAURANT_STORAGE_KEY,
          persistenceStripOpeningHoursForRemote(n),
        ).then((ok) => {
          if (!ok) {
            setStore(prev);
            failSave();
          } else {
            toast.success("Restaurantprofil gespeichert");
          }
        });
        return n;
      });
    },
    [failSave],
  );

  const saveOpeningHours = useCallback(
    async (next: RestaurantProfile): Promise<boolean> => {
      const snapshot = storeRef.current;
      setStore((p) => ({
        ...p,
        restaurants: {
          ...p.restaurants,
          [next.id]: next,
        },
      }));

      const rid = await getWorkspaceRestaurantId();
      const useDb =
        openingHoursDbEnabled() && rid !== null && isUuidRestaurantId(next.id);

      if (useDb) {
        const ok = await replaceOpeningHoursForRestaurant(rid, next);
        if (!ok) {
          setStore(snapshot);
          failSave();
          return false;
        }
      }

      const merged: RestaurantPersistenceV1 = {
        ...snapshot,
        restaurants: {
          ...snapshot.restaurants,
          [next.id]: next,
        },
      };

      const ok = await persistWorkspaceState(
        RESTAURANT_STORAGE_KEY,
        persistenceStripOpeningHoursForRemote(merged),
      );
      if (!ok) {
        setStore(snapshot);
        failSave();
        return false;
      }
      toast.success("Öffnungszeiten gespeichert");
      return true;
    },
    [failSave],
  );

  const setSelectedRestaurantId = useCallback(
    (id: string) => {
      setStore((prev) => {
        const restaurants = { ...prev.restaurants };
        if (!restaurants[id]) {
          restaurants[id] = mergeRestaurantProfile(id, undefined);
        }
        const n: RestaurantPersistenceV1 = {
          ...prev,
          selectedRestaurantId: id,
          restaurants,
        };
        void persistWorkspaceState(
          RESTAURANT_STORAGE_KEY,
          persistenceStripOpeningHoursForRemote(n),
        ).then((ok) => {
          if (!ok) {
            setStore(prev);
            failSave();
          } else {
            toast.success("Restaurant-Auswahl gespeichert");
          }
        });
        return n;
      });
    },
    [failSave],
  );

  const selectedRestaurantId = store.selectedRestaurantId;

  const profile = useMemo(() => {
    const p = store.restaurants[selectedRestaurantId];
    if (p) return p;
    return mergeRestaurantProfile(selectedRestaurantId, undefined);
  }, [store.restaurants, selectedRestaurantId]);

  const value = useMemo(
    () => ({
      isReady,
      selectedRestaurantId,
      profile,
      saveProfile,
      saveOpeningHours,
      setSelectedRestaurantId,
    }),
    [
      isReady,
      selectedRestaurantId,
      profile,
      saveProfile,
      saveOpeningHours,
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
