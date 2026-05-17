"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type MyRestaurantRow = {
  restaurantId: string;
  role: string;
  name: string;
  slug: string;
  isPublished: boolean;
};

type RestaurantJoin = {
  id: string;
  name: string;
  slug: string;
  is_published: boolean;
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
    void sb.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });
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
        .select("restaurant_id, role, restaurants(id, name, slug, is_published)")
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
            role: row.role as string,
            name: rr.name,
            slug: rr.slug,
            isPublished: rr.is_published,
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
