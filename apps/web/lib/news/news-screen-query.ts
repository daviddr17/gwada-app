import {
  parseNewsPlatformFilter,
  parseNewsViewMode,
  type NewsPlatformFilter,
  type NewsViewMode,
} from "@/lib/constants/news-platforms";

export function readNewsScreenQueryFromSearch(search: string): {
  platformFilter: NewsPlatformFilter;
  viewMode: NewsViewMode;
} {
  const params = new URLSearchParams(search);
  return {
    platformFilter: parseNewsPlatformFilter(params.get("platform")),
    viewMode: parseNewsViewMode(params.get("view")),
  };
}

/** URL für Lesezeichen/Teilen — ohne Next.js router.replace (vermeidet Navigation-Lag). */
export function patchNewsScreenQueryUrl(
  pathname: string,
  patch: (params: URLSearchParams) => void,
): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  patch(params);
  const qs = params.toString();
  const href = qs ? `${pathname}?${qs}` : pathname;
  window.history.replaceState(window.history.state, "", href);
}
