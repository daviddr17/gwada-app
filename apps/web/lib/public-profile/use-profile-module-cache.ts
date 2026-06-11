"use client";

import type { PublicEmbedNews } from "@/lib/news/public-news-server";
import type { PublicEmbedMenu } from "@/lib/menu/public-menu-server";
import type { PublicEmbedRestaurant } from "@/lib/reservations/public-embed-shared";
import type { PublicEmbedReviews } from "@/lib/reviews/public-reviews-server";
import { useCallback, useRef, useState } from "react";

export type ProfileModuleKey = "reservation" | "menu" | "reviews" | "news";

type ModuleCache = {
  reservation: PublicEmbedRestaurant | null;
  menu: PublicEmbedMenu | null;
  reviews: PublicEmbedReviews | null;
  news: PublicEmbedNews | null;
};

type ModuleState = {
  loading: boolean;
  error: string | null;
};

export type LoadModuleOptions = {
  force?: boolean;
  /** Hintergrund-Vorladen — kein sichtbarer Loading-State. */
  silent?: boolean;
};

const INITIAL_CACHE: ModuleCache = {
  reservation: null,
  menu: null,
  reviews: null,
  news: null,
};

const INITIAL_STATE: Record<ProfileModuleKey, ModuleState> = {
  reservation: { loading: false, error: null },
  menu: { loading: false, error: null },
  reviews: { loading: false, error: null },
  news: { loading: false, error: null },
};

export function useProfileModuleCache(slug: string) {
  const [cache, setCache] = useState<ModuleCache>(INITIAL_CACHE);
  const [state, setState] = useState(INITIAL_STATE);
  const inflight = useRef<Partial<Record<ProfileModuleKey, Promise<void>>>>({});
  const cacheRef = useRef(cache);
  cacheRef.current = cache;

  const loadModule = useCallback(
    async (module: ProfileModuleKey, options: LoadModuleOptions = {}) => {
      const { force = false, silent = false } = options;

      if (!force && cacheRef.current[module]) return;
      if (inflight.current[module]) {
        await inflight.current[module];
        return;
      }

      if (!silent) {
        setState((prev) => ({
          ...prev,
          [module]: { loading: true, error: null },
        }));
      }

      const task = (async () => {
        try {
          const res = await fetch(
            `/api/public/profile/${encodeURIComponent(slug)}/${module}`,
          );
          if (!res.ok) {
            if (!silent) {
              setState((prev) => ({
                ...prev,
                [module]: { loading: false, error: "load_failed" },
              }));
            }
            return;
          }
          const data = (await res.json()) as
            | PublicEmbedRestaurant
            | PublicEmbedMenu
            | PublicEmbedReviews
            | PublicEmbedNews;
          setCache((prev) => ({ ...prev, [module]: data }));
          setState((prev) => ({
            ...prev,
            [module]: { loading: false, error: null },
          }));
        } catch {
          if (!silent) {
            setState((prev) => ({
              ...prev,
              [module]: { loading: false, error: "load_failed" },
            }));
          }
        } finally {
          delete inflight.current[module];
        }
      })();

      inflight.current[module] = task;
      await task;
    },
    [slug],
  );

  const preloadModules = useCallback(
    async (modules: ProfileModuleKey[]) => {
      for (const module of modules) {
        if (cacheRef.current[module]) continue;
        await loadModule(module, { silent: true });
        await new Promise((resolve) => setTimeout(resolve, 32));
      }
    },
    [loadModule],
  );

  return { cache, state, loadModule, preloadModules };
}
