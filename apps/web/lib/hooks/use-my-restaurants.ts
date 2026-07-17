"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  GWADA_SUPABASE_FETCH_TIMEOUT_MS,
  raceWithTimeout,
} from "@/lib/supabase/race-timeout";
import { GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT } from "@/lib/supabase/workspace-persistence";

export type MyRestaurantRow = {
  restaurantId: string;
  name: string;
  slug: string;
  avatarStoragePath: string | null;
  coverStoragePath: string | null;
  brandAccentHex: string | null;
};

type RestaurantJoin = {
  id: string;
  name: string;
  slug: string;
  avatar_storage_path: string | null;
  cover_storage_path: string | null;
  brand_accent_hex: string | null;
};

export function useMyRestaurants() {
  const [session, setSession] = useState<Session | null>(null);
  const [rows, setRows] = useState<MyRestaurantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    void raceWithTimeout(
      sb.auth.getSession(),
      GWADA_SUPABASE_FETCH_TIMEOUT_MS,
      "Supabase-Session (Restaurants)",
    ).then(
      ({ data }) => {
        setSession(data.session ?? null);
      },
      () => {
        setSession(null);
      },
    );
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const onWorkspaceChange = () => {
      setVersion((v) => v + 1);
    };
    window.addEventListener(
      GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
      onWorkspaceChange,
    );
    return () => {
      window.removeEventListener(
        GWADA_WORKSPACE_RESTAURANT_CHANGED_EVENT,
        onWorkspaceChange,
      );
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!session?.user) {
      setRows([]);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      setLoading(true);
      const sb = createSupabaseBrowserClient();
      const { data, error } = await sb
        .from("restaurant_employees")
        .select(
          "restaurant_id, restaurants(id, name, slug, avatar_storage_path, cover_storage_path, brand_accent_hex)",
        )
        .eq("profile_id", session.user.id)
        .eq("is_active", true);

      if (cancelled) return;

      if (error) {
        console.warn("[gwada] useMyRestaurants", error.message);
        setRows([]);
      } else {
        const out: MyRestaurantRow[] = [];
        for (const row of data ?? []) {
          const r = row.restaurants as RestaurantJoin | RestaurantJoin[] | null;
          const rr = Array.isArray(r) ? r[0] : r;
          if (!rr) continue;
          out.push({
            restaurantId: row.restaurant_id as string,
            name: rr.name,
            slug: rr.slug,
            avatarStoragePath:
              typeof rr.avatar_storage_path === "string"
                ? rr.avatar_storage_path
                : null,
            coverStoragePath:
              typeof rr.cover_storage_path === "string"
                ? rr.cover_storage_path
                : null,
            brandAccentHex:
              typeof rr.brand_accent_hex === "string"
                ? rr.brand_accent_hex
                : null,
          });
        }
        setRows(out);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [session, version]);

  return { session, rows, loading, refresh };
}
