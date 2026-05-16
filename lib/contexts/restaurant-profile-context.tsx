"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import {
  mergeRestaurantProfile,
  parsePersistence,
} from "@/lib/restaurant/profile-utils";
import { RESTAURANT_STORAGE_KEY } from "@/lib/constants/restaurant-profile";
import { toastStorageError } from "@/lib/persist-notify";
import type {
  RestaurantPersistenceV1,
  RestaurantProfile,
} from "@/lib/types/restaurant";

type RestaurantProfileContextValue = {
  isReady: boolean;
  selectedRestaurantId: string;
  profile: RestaurantProfile;
  saveProfile: (next: RestaurantProfile) => void;
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
  const [store, setStore] = useState<RestaurantPersistenceV1>(() =>
    parsePersistence(null),
  );
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const raw =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(RESTAURANT_STORAGE_KEY)
        : null;
    const frame = requestAnimationFrame(() => {
      setStore(parsePersistence(raw));
      setIsReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const saveProfile = useCallback((next: RestaurantProfile) => {
    setStore((prev) => {
      const n: RestaurantPersistenceV1 = {
        ...prev,
        restaurants: {
          ...prev.restaurants,
          [next.id]: next,
        },
      };
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(RESTAURANT_STORAGE_KEY, JSON.stringify(n));
        }
        toast.success("Restaurantprofil gespeichert");
        return n;
      } catch (e) {
        console.error(e);
        toastStorageError();
        return prev;
      }
    });
  }, []);

  const setSelectedRestaurantId = useCallback((id: string) => {
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
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(RESTAURANT_STORAGE_KEY, JSON.stringify(n));
        }
        toast.success("Restaurant-Auswahl gespeichert");
        return n;
      } catch (e) {
        console.error(e);
        toastStorageError();
        return prev;
      }
    });
  }, []);

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
      setSelectedRestaurantId,
    }),
    [
      isReady,
      selectedRestaurantId,
      profile,
      saveProfile,
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
