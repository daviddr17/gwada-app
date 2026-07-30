/** WAHA-Versionsvergleich (API + GitHub Releases). */

export type WahaServerVersionInfo = {
  version: string | null;
  engine: string | null;
  nodeVersion: string | null;
};

export type WahaLatestReleaseInfo = {
  version: string;
  publishedAt: string | null;
  htmlUrl: string | null;
};

/** Extrahiert `2026.7.2` aus Tags wie `latest-2026.7.2`, `v2026.7.2`, `noweb-2026.7.2`. */
export function normalizeWahaVersion(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/^v/i, "");
  const m = s.match(/(\d{4}\.\d{1,2}\.\d{1,2})/);
  return m?.[1] ?? (s || null);
}

/** Vergleich `YYYY.M.B` — positiv wenn a > b. */
export function compareWahaVersions(a: string, b: string): number {
  const pa = a.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export function isWahaUpdateAvailable(
  currentRaw: string | null | undefined,
  latestRaw: string | null | undefined,
): boolean {
  const current = normalizeWahaVersion(currentRaw);
  const latest = normalizeWahaVersion(latestRaw);
  if (!current || !latest) return false;
  return compareWahaVersions(latest, current) > 0;
}

export function parseWahaVersionPayload(body: unknown): WahaServerVersionInfo {
  if (!body || typeof body !== "object") {
    return { version: null, engine: null, nodeVersion: null };
  }
  const o = body as Record<string, unknown>;
  const version =
    typeof o.version === "string"
      ? o.version
      : typeof o.Version === "string"
        ? o.Version
        : null;
  const engine =
    typeof o.engine === "string"
      ? o.engine
      : typeof o.Engine === "string"
        ? o.Engine
        : null;
  const nodeVersion =
    typeof o.node_version === "string"
      ? o.node_version
      : typeof o.nodeVersion === "string"
        ? o.nodeVersion
        : null;
  return { version, engine, nodeVersion };
}
