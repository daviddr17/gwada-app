import "server-only";

import {
  isWahaUpdateAvailable,
  normalizeWahaVersion,
  parseWahaVersionPayload,
  type WahaLatestReleaseInfo,
  type WahaServerVersionInfo,
} from "@/lib/waha/waha-version";

const LATEST_CACHE_TTL_MS = 15 * 60 * 1000;

let latestCache: { at: number; value: WahaLatestReleaseInfo | null } | null =
  null;

/** Aktuelle Version vom laufenden WAHA-Server (`GET /api/server/version`). */
export async function fetchWahaServerVersion(input: {
  baseUrl: string;
  apiKey: string;
  signal?: AbortSignal;
}): Promise<WahaServerVersionInfo & { ok: boolean; error?: string }> {
  const base = input.baseUrl.replace(/\/+$/, "");
  const headers = {
    "X-Api-Key": input.apiKey,
    Accept: "application/json",
  };

  const tryUrls = [`${base}/api/server/version`, `${base}/api/version`];
  let lastError = "version_unreachable";

  for (const url of tryUrls) {
    try {
      const res = await fetch(url, {
        headers,
        cache: "no-store",
        signal: input.signal,
      });
      if (!res.ok) {
        lastError = `WAHA HTTP ${res.status}`;
        continue;
      }
      const body = (await res.json().catch(() => null)) as unknown;
      const parsed = parseWahaVersionPayload(body);
      if (!parsed.version) {
        lastError = "version_missing_in_response";
        continue;
      }
      return { ok: true, ...parsed };
    } catch (e) {
      lastError = e instanceof Error ? e.message : "version_failed";
    }
  }

  return {
    ok: false,
    version: null,
    engine: null,
    nodeVersion: null,
    error: lastError,
  };
}

/**
 * Neueste WAHA-Release von GitHub (öffentlich, Core-Repo).
 * Versionierung entspricht Docker-Tags `latest-{YEAR}.{MONTH}.{BUILD}`.
 */
export async function fetchLatestWahaRelease(options?: {
  force?: boolean;
}): Promise<WahaLatestReleaseInfo | null> {
  const now = Date.now();
  if (
    !options?.force &&
    latestCache &&
    now - latestCache.at < LATEST_CACHE_TTL_MS
  ) {
    return latestCache.value;
  }

  try {
    const res = await fetch(
      "https://api.github.com/repos/devlikeapro/waha/releases/latest",
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "gwada-app-waha-version",
        },
        cache: "no-store",
        next: { revalidate: 0 },
      },
    );
    if (!res.ok) {
      latestCache = { at: now, value: null };
      return null;
    }
    const body = (await res.json()) as {
      tag_name?: string;
      name?: string;
      published_at?: string;
      html_url?: string;
    };
    const version = normalizeWahaVersion(body.tag_name ?? body.name ?? null);
    if (!version) {
      latestCache = { at: now, value: null };
      return null;
    }
    const value: WahaLatestReleaseInfo = {
      version,
      publishedAt: body.published_at ?? null,
      htmlUrl: body.html_url ?? null,
    };
    latestCache = { at: now, value };
    return value;
  } catch {
    latestCache = { at: now, value: null };
    return null;
  }
}

export async function buildWahaVersionStatus(input: {
  baseUrl: string;
  apiKey: string;
}): Promise<{
  current: WahaServerVersionInfo & { ok: boolean; error?: string };
  latest: WahaLatestReleaseInfo | null;
  updateAvailable: boolean;
}> {
  const [current, latest] = await Promise.all([
    fetchWahaServerVersion(input),
    fetchLatestWahaRelease(),
  ]);
  return {
    current,
    latest,
    updateAvailable: isWahaUpdateAvailable(
      current.version,
      latest?.version ?? null,
    ),
  };
}
