"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchIsSuperadmin } from "@/lib/supabase/platform-superadmin-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function useIsSuperadmin() {
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const sb = createSupabaseBrowserClient();
    const ok = await fetchIsSuperadmin(sb);
    setIsSuperadmin(ok);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { isSuperadmin, loading, reload };
}
