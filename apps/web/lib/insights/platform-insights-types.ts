/** Gemeinsame Typen für externe Plattform-Insights (Google / Meta). */

export type PlatformInsightMetric = {
  key: string;
  label: string;
  value: number;
};

export type PlatformInsightDayPoint = {
  date: string;
  label: string;
  value: number;
};

export type PlatformInsightSeries = {
  key: string;
  label: string;
  total: number;
  byDay: PlatformInsightDayPoint[];
};

export type GoogleSearchKeywordInsight = {
  keyword: string;
  /** Exakte Impressionen, sonst null wenn nur Schwellwert. */
  impressions: number | null;
  /** Unter diesem Wert (Datenschutz), wenn impressions null. */
  threshold: number | null;
};

export type GoogleBusinessPlatformInsights = {
  platform: "google_business";
  connected: boolean;
  available: boolean;
  error: string | null;
  metrics: PlatformInsightMetric[];
  series: PlatformInsightSeries[];
  impressions: number;
  searchImpressions: number;
  mapsImpressions: number;
  searchDesktop: number;
  searchMobile: number;
  mapsDesktop: number;
  mapsMobile: number;
  websiteClicks: number;
  callClicks: number;
  directionRequests: number;
  conversations: number;
  bookings: number;
  menuClicks: number;
  foodOrders: number;
  interactions: number;
  /** Top-Suchbegriffe (monatlich aggregiert von Google). */
  searchKeywords: GoogleSearchKeywordInsight[];
};

export type FacebookPagePlatformInsights = {
  platform: "facebook";
  connected: boolean;
  available: boolean;
  error: string | null;
  metrics: PlatformInsightMetric[];
  series: PlatformInsightSeries[];
  impressions: number;
  reach: number;
  postEngagements: number;
  pageViews: number;
  fans: number | null;
  followsUnique: number;
  unfollowsUnique: number;
  ctaClicks: number;
  videoViews: number;
  needsReconnect: boolean;
};

export type InstagramAccountPlatformInsights = {
  platform: "instagram";
  connected: boolean;
  available: boolean;
  error: string | null;
  metrics: PlatformInsightMetric[];
  series: PlatformInsightSeries[];
  reach: number;
  views: number;
  accountsEngaged: number;
  totalInteractions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  replies: number;
  profileLinkTaps: number;
  follows: number;
  unfollows: number;
};

export type PlatformInsightsBundle = {
  google: GoogleBusinessPlatformInsights;
  facebook: FacebookPagePlatformInsights;
  instagram: InstagramAccountPlatformInsights;
};

export function emptyGoogleInsights(
  partial?: Partial<GoogleBusinessPlatformInsights>,
): GoogleBusinessPlatformInsights {
  return {
    platform: "google_business",
    connected: false,
    available: false,
    error: null,
    metrics: [],
    series: [],
    impressions: 0,
    searchImpressions: 0,
    mapsImpressions: 0,
    searchDesktop: 0,
    searchMobile: 0,
    mapsDesktop: 0,
    mapsMobile: 0,
    websiteClicks: 0,
    callClicks: 0,
    directionRequests: 0,
    conversations: 0,
    bookings: 0,
    menuClicks: 0,
    foodOrders: 0,
    interactions: 0,
    searchKeywords: [],
    ...partial,
  };
}

export function emptyFacebookInsights(
  partial?: Partial<FacebookPagePlatformInsights>,
): FacebookPagePlatformInsights {
  return {
    platform: "facebook",
    connected: false,
    available: false,
    error: null,
    metrics: [],
    series: [],
    impressions: 0,
    reach: 0,
    postEngagements: 0,
    pageViews: 0,
    fans: null,
    followsUnique: 0,
    unfollowsUnique: 0,
    ctaClicks: 0,
    videoViews: 0,
    needsReconnect: false,
    ...partial,
  };
}

export function emptyInstagramInsights(
  partial?: Partial<InstagramAccountPlatformInsights>,
): InstagramAccountPlatformInsights {
  return {
    platform: "instagram",
    connected: false,
    available: false,
    error: null,
    metrics: [],
    series: [],
    reach: 0,
    views: 0,
    accountsEngaged: 0,
    totalInteractions: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    replies: 0,
    profileLinkTaps: 0,
    follows: 0,
    unfollows: 0,
    ...partial,
  };
}

export function formatInsightCount(value: number): string {
  return new Intl.NumberFormat("de-DE").format(Math.round(value));
}

export function ymdFromIso(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
  });
}
