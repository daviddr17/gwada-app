"use client";

import { useCallback, useEffect, useState } from "react";
import type { UnifiedContactListRow } from "@/lib/contacts/unified-contact-row";

export function useAccountingContacts(restaurantId: string | null) {
  const [contacts, setContacts] = useState<UnifiedContactListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [lexofficeConnected, setLexofficeConnected] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setContacts([]);
      setLexofficeConnected(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/contacts/unified?${new URLSearchParams({ restaurantId })}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("load_failed");
      const body = (await res.json()) as {
        items?: UnifiedContactListRow[];
        integration?: { connected?: boolean };
      };
      setContacts(body.items ?? []);
      setLexofficeConnected(Boolean(body.integration?.connected));
    } catch {
      setContacts([]);
      setLexofficeConnected(false);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { contacts, loading, lexofficeConnected, reload: load };
}
