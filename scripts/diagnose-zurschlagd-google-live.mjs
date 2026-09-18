/**
 * Live-Probe im App-Container. Druckt keine Tokens, Secrets oder URLs mit Query.
 */
(async () => {
const base = (
  process.env.SUPABASE_UPSTREAM_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!base || !key) {
  console.error("missing_supabase_env");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
};

function summarizeError(body) {
  const err = body?.error;
  if (!err || typeof err !== "object") return null;
  const first = Array.isArray(err.errors) ? err.errors[0] : null;
  return {
    message: typeof err.message === "string" ? err.message.slice(0, 300) : null,
    status: err.status ?? null,
    reason: first?.reason ?? null,
  };
}

async function googleGet(token, url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Accept-Language": "de, en;q=0.4",
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return {
    http: res.status,
    error: summarizeError(body),
    reviewCount: Array.isArray(body?.reviews) ? body.reviews.length : null,
    totalReviewCount:
      typeof body?.totalReviewCount === "number" ? body.totalReviewCount : null,
    mediaCount: Array.isArray(body?.mediaItems) ? body.mediaItems.length : null,
    postCount: Array.isArray(body?.localPosts) ? body.localPosts.length : null,
    firstMediaHost: mediaHost(body?.mediaItems?.[0]),
    keys: body && typeof body === "object" ? Object.keys(body).slice(0, 12) : [],
    snippet: body ? null : text.slice(0, 180),
  };
}

function mediaHost(item) {
  const raw = item?.googleUrl || item?.thumbnailUrl;
  if (typeof raw !== "string" || !raw) return null;
  try {
    return new URL(raw).host;
  } catch {
    return "unparseable";
  }
}

async function headHost(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { method: "GET", redirect: "manual" });
    return { http: res.status, type: res.headers.get("content-type") };
  } catch (error) {
    return { http: 0, type: error instanceof Error ? error.name : "fetch_failed" };
  }
}

const restaurants = await (
  await fetch(
    `${base}/rest/v1/restaurants?slug=eq.zurschlagd&select=id,slug,name`,
    { headers },
  )
).json();
const restaurant = restaurants?.[0];
console.log("restaurant", restaurant?.slug ?? null, Boolean(restaurant?.id));
if (!restaurant?.id) process.exit(1);

const rows = await (
  await fetch(
    `${base}/rest/v1/restaurant_integrations?restaurant_id=eq.${restaurant.id}&integration_key=eq.google_business&select=status,display_name,last_error,connected_at,updated_at,config`,
    { headers },
  )
).json();
const row = rows?.[0];
const cfg = row?.config && typeof row.config === "object" ? row.config : {};
console.log(
  "integration",
  JSON.stringify({
    status: row?.status ?? null,
    display_name: row?.display_name ?? null,
    last_error: row?.last_error ?? null,
    connected_at: row?.connected_at ?? null,
    updated_at: row?.updated_at ?? null,
    account_name: cfg.account_name ?? null,
    account_title: cfg.account_title ?? null,
    location_name: cfg.location_name ?? null,
    location_title: cfg.location_title ?? null,
    has_access_token: Boolean(cfg.access_token),
    has_refresh_token: Boolean(cfg.refresh_token),
    granted_scopes: cfg.granted_scopes ?? null,
  }),
);

const platformRows = await (
  await fetch(
    `${base}/rest/v1/platform_integrations?key=eq.google_business&select=enabled,config`,
    { headers },
  )
).json();
const platform = platformRows?.[0];
const pcfg = platform?.config && typeof platform.config === "object" ? platform.config : {};
console.log(
  "platform",
  JSON.stringify({
    enabled: platform?.enabled ?? null,
    has_client_id: Boolean(pcfg.client_id),
    has_client_secret: Boolean(pcfg.client_secret),
  }),
);

const account = String(cfg.account_name ?? "").trim();
const location = String(cfg.location_name ?? "").trim();
const parent = account && location
  ? location.startsWith("accounts/")
    ? location
    : `${account}/${location}`
  : "";
console.log("parent_set", Boolean(parent), "location_prefix", location.split("/")[0] || null);

let token = String(cfg.access_token ?? "").trim();
if (parent && token) {
  const reviewsUrl = `https://mybusiness.googleapis.com/v4/${parent}/reviews?pageSize=1&orderBy=updateTime%20desc`;
  const stored = await googleGet(token, reviewsUrl);
  console.log("reviews_stored_token", JSON.stringify(stored));
}

let refreshError = null;
if (cfg.refresh_token && pcfg.client_id && pcfg.client_secret) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: pcfg.client_id,
      client_secret: pcfg.client_secret,
      refresh_token: cfg.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const body = await res.json().catch(() => ({}));
  refreshError = body.error_description || body.error || null;
  console.log(
    "refresh",
    JSON.stringify({
      http: res.status,
      ok: Boolean(body.access_token),
      error: refreshError,
    }),
  );
  if (body.access_token) token = body.access_token;
} else {
  console.log("refresh", "skipped");
}

if (!parent || !token) {
  console.log("probe_skipped", "missing_parent_or_token");
  process.exit(0);
}

const reviews = await googleGet(
  token,
  `https://mybusiness.googleapis.com/v4/${parent}/reviews?pageSize=1&orderBy=updateTime%20desc`,
);
console.log("reviews_fresh_token", JSON.stringify(reviews));

const media = await googleGet(
  token,
  `https://mybusiness.googleapis.com/v4/${parent}/media?pageSize=1`,
);
console.log("media_owner", JSON.stringify(media));

const customer = await googleGet(
  token,
  `https://mybusiness.googleapis.com/v4/${parent}/media/customers?pageSize=1`,
);
console.log("media_customers", JSON.stringify(customer));

const posts = await googleGet(
  token,
  `https://mybusiness.googleapis.com/v4/${parent}/localPosts?pageSize=1`,
);
console.log("local_posts", JSON.stringify(posts));

const locationId = location.startsWith("locations/")
  ? location
  : (location.match(/locations\/[^/]+/)?.[0] ?? "");
if (locationId) {
  const info = await googleGet(
    token,
    `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?readMask=name,title`,
  );
  console.log("business_info", JSON.stringify(info));
}
})().catch((error) => {
  console.error("probe_failed", error instanceof Error ? error.message : "unknown");
  process.exit(1);
});
