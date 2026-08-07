"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { keepAliveMayNavigate } from "@/lib/navigation/module-home-keep-alive";

/**
 * router.push/replace no-op wenn Keep-alive-Slot inactive —
 * verhindert URL-Mutation auf fremde Module während warm+hidden.
 */
export function useKeepAliveGatedRouter(active: boolean) {
  const router = useRouter();
  return useMemo(() => {
    return {
      ...router,
      push: ((href, options) => {
        if (!keepAliveMayNavigate(active)) return;
        return router.push(href, options);
      }) as typeof router.push,
      replace: ((href, options) => {
        if (!keepAliveMayNavigate(active)) return;
        return router.replace(href, options);
      }) as typeof router.replace,
    };
  }, [active, router]);
}
