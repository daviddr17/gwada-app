"use client";

import { useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function useServerInsertedHTML(_callback: () => ReactNode): void {
  /* SPA — kein RSC-HTML-Insert. */
}


export function usePathname(): string {
  const { location } = useRouterState();
  const path = location.pathname;
  if (path === "/" || path === "") return "/dashboard";
  return `/dashboard${path.startsWith("/") ? path : `/${path}`}`;
}

export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (href: string) => {
      const path = href.split("?")[0] ?? href;
      const searchStr = href.includes("?") ? href.split("?")[1] : "";
      const to =
        path === "/dashboard"
          ? "/"
          : path.replace(/^\/dashboard/, "") || "/";
      const search: Record<string, string> = {};
      if (searchStr) {
        for (const pair of searchStr.split("&")) {
          const [k, v] = pair.split("=");
          if (k) search[k] = decodeURIComponent(v ?? "");
        }
      }
      navigate({ to, search });
    },
    replace: (href: string) => {
      const path = href.split("?")[0] ?? href;
      const to =
        path === "/dashboard"
          ? "/"
          : path.replace(/^\/dashboard/, "") || "/";
      navigate({ to, replace: true });
    },
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => window.location.reload(),
    prefetch: () => {},
  };
}

export function useSearchParams(): URLSearchParams {
  const { location } = useRouterState();
  return new URLSearchParams(location.searchStr ?? "");
}

export function useParams<
  T extends Record<string, string> = Record<string, string>,
>(): T {
  const { location } = useRouterState();
  const parts = location.pathname.split("/").filter(Boolean);
  const params: Record<string, string> = {};
  // TanStack passes params via route - fallback empty
  void parts;
  return params as T;
}
