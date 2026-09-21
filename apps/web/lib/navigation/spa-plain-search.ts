/**
 * Plain URLSearchParams codec for Dashboard/Superadmin TanStack SPAs.
 *
 * TanStack Router's default JSON search serializer quotes numeric-looking
 * strings (`"1"` → `%221%22`). Our Next-style shims read raw `searchStr` via
 * `URLSearchParams`, so `get("new") === "1"` fails while `day=YYYY-MM-DD`
 * still matches — FAB „Neue Reservierung“ opened today's day sheet instead
 * of the create drawer.
 */

export function parseSpaPlainSearch(
  searchStr: string,
): Record<string, string> {
  const raw = searchStr.startsWith("?") ? searchStr.slice(1) : searchStr;
  const out: Record<string, string> = {};
  if (!raw) return out;
  for (const [key, value] of new URLSearchParams(raw)) {
    out[key] = value;
  }
  return out;
}

export function stringifySpaPlainSearch(
  search: Record<string, unknown>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      params.set(key, value);
    } else if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "bigint"
    ) {
      params.set(key, String(value));
    } else {
      params.set(key, JSON.stringify(value));
    }
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

/** Build URLSearchParams from TanStack's already-parsed `location.search`. */
export function urlSearchParamsFromParsedSearch(
  search: Record<string, unknown> | null | undefined,
): URLSearchParams {
  const params = new URLSearchParams();
  if (!search) return params;
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null) continue;
    params.set(key, typeof value === "string" ? value : String(value));
  }
  return params;
}
