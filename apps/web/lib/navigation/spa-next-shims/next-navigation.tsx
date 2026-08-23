"use client";

import {
  usePathname as useNextPathname,
  useRouter as useNextRouter,
  useSearchParams as useNextSearchParams,
  useParams as useNextParams,
} from "next/dist/client/components/navigation";
import type { ReactNode } from "react";
import { useSpaZoneNavigationOptional } from "@/lib/navigation/spa-zone-navigation-bridge";

export function useServerInsertedHTML(_callback: () => ReactNode): void {
  /* SPA — kein RSC-HTML-Insert. */
}

export function usePathname(): string {
  const spa = useSpaZoneNavigationOptional();
  const nextPathname = useNextPathname();
  return spa?.pathname ?? nextPathname;
}

export function useRouter() {
  const spa = useSpaZoneNavigationOptional();
  const nextRouter = useNextRouter();

  if (!spa) {
    return nextRouter;
  }

  const { navigate, hrefToTarget } = spa;

  return {
    push: (href: string) => {
      const { to, search } = hrefToTarget(href);
      navigate({ to, search });
    },
    replace: (href: string) => {
      const { to, search } = hrefToTarget(href);
      navigate({ to, search, replace: true });
    },
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => window.location.reload(),
    prefetch: () => {},
  };
}

export function useSearchParams(): URLSearchParams {
  const spa = useSpaZoneNavigationOptional();
  const nextSearchParams = useNextSearchParams();
  if (!spa) {
    return nextSearchParams;
  }
  return new URLSearchParams(spa.searchStr);
}

export function useParams<
  T extends Record<string, string> = Record<string, string>,
>(): T {
  const spa = useSpaZoneNavigationOptional();
  const nextParams = useNextParams();
  if (!spa) {
    return nextParams as T;
  }
  return spa.params as T;
}
