export type ReviewViewMode = "grid" | "list";

export function parseReviewViewMode(value: string | null): ReviewViewMode {
  return value === "list" ? "list" : "grid";
}

export function readReviewsScreenQueryFromSearch(search: string): {
  viewMode: ReviewViewMode;
} {
  const params = new URLSearchParams(search);
  return {
    viewMode: parseReviewViewMode(params.get("view")),
  };
}

export function patchReviewsScreenQueryUrl(
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
