export type AnalyticsDevice = "desktop" | "mobile" | "tablet" | "unknown";

export type AnalyticsBrowser =
  | "chrome"
  | "safari"
  | "firefox"
  | "edge"
  | "opera"
  | "samsung"
  | "other"
  | "unknown";

const OWN_HOSTS = new Set(["gwada.app", "www.gwada.app", "localhost", "127.0.0.1"]);

export function parseAnalyticsDevice(userAgent: string | null): AnalyticsDevice {
  const ua = userAgent ?? "";
  if (!ua.trim()) return "unknown";
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|windows phone|opera mini/i.test(ua)) return "mobile";
  return "desktop";
}

export function parseAnalyticsBrowser(userAgent: string | null): AnalyticsBrowser {
  const ua = userAgent ?? "";
  if (!ua.trim()) return "unknown";
  if (/edg\//i.test(ua)) return "edge";
  if (/opr\/|opera/i.test(ua)) return "opera";
  if (/samsungbrowser/i.test(ua)) return "samsung";
  if (/firefox|fxios/i.test(ua)) return "firefox";
  if (/chrome|crios|chromium/i.test(ua) && !/edg\//i.test(ua)) return "chrome";
  if (/safari/i.test(ua)) return "safari";
  return "other";
}

/** ISO-Land aus Edge-Headern. Die IP selbst wird nicht gelesen und nicht gespeichert. */
export function countryCodeFromHeaders(headers: Headers): string | null {
  const raw =
    headers.get("cf-ipcountry") ??
    headers.get("x-vercel-ip-country") ??
    headers.get("cloudfront-viewer-country") ??
    headers.get("x-country-code");
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  if (code === "XX" || code === "T1") return null;
  return code;
}

export function externalReferrerHost(
  raw: string | null | undefined,
  requestHost: string | null,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host.length > 200) return null;
  const request = requestHost?.split(":")[0]?.toLowerCase() ?? "";
  if (host === request || OWN_HOSTS.has(host)) return null;
  if (host.endsWith(".gwada.app")) return null;
  return host;
}

const VISITOR_COOKIE = "gwada_analytics_vid";
const SESSION_COOKIE = "gwada_analytics_sid";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAnalyticsUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export const ANALYTICS_VISITOR_COOKIE = VISITOR_COOKIE;
export const ANALYTICS_SESSION_COOKIE = SESSION_COOKIE;

export type PageViewInsert = {
  path: string;
  surface: string;
  referrer_host: string | null;
  device: AnalyticsDevice;
  browser: AnalyticsBrowser;
  country_code: string | null;
  visitor_id: string;
  session_id: string;
};

export function buildPageViewInsert(input: PageViewInsert): PageViewInsert {
  return {
    path: input.path,
    surface: input.surface,
    referrer_host: input.referrer_host,
    device: input.device,
    browser: input.browser,
    country_code: input.country_code,
    visitor_id: input.visitor_id,
    session_id: input.session_id,
  };
}
