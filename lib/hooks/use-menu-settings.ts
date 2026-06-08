"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_MENU_CURRENCY_CODE,
  normalizeMenuCurrencyCode,
  type MenuCurrencyCode,
} from "@/lib/constants/menu-currencies";
import { fetchMenuSettings } from "@/lib/supabase/menu-settings-db";

export function useMenuSettings(restaurantId: string | null) {
  const [currencyCode, setCurrencyCode] = useState<MenuCurrencyCode>(
    DEFAULT_MENU_CURRENCY_CODE,
  );
  const [loading, setLoading] = useState(Boolean(restaurantId));
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    if (!restaurantId) {
      setCurrencyCode(DEFAULT_MENU_CURRENCY_CODE);
      setLoading(false);
      setReady(true);
      return;
    }
    setLoading(true);
    const { data, error } = await fetchMenuSettings(restaurantId);
    if (error) {
      setLoading(false);
      setReady(true);
      return;
    }
    setCurrencyCode(normalizeMenuCurrencyCode(data?.currency_code));
    setLoading(false);
    setReady(true);
  }, [restaurantId]);

  useEffect(() => {
    setReady(false);
    void reload();
  }, [reload]);

  return { currencyCode, loading, ready, reload };
}
