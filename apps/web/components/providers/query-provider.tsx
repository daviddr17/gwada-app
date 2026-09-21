"use client";

import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { createAppQueryClient } from "@/lib/query/create-query-client";
import { pruneInactiveAppQueries } from "@/lib/query/prune-inactive-app-queries";

const PRUNE_INTERVAL_MS = 12 * 60_000;

function QueryCacheLongSessionHygiene() {
  const client = useQueryClient();

  useEffect(() => {
    const prune = () => {
      if (document.visibilityState !== "visible") return;
      pruneInactiveAppQueries(client);
    };

    const intervalId = window.setInterval(prune, PRUNE_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") prune();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [client]);

  return null;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createAppQueryClient());
  return (
    <QueryClientProvider client={client}>
      <QueryCacheLongSessionHygiene />
      {children}
    </QueryClientProvider>
  );
}
