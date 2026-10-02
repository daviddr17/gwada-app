export type AnalyticsBucket = "hour" | "day";

export type WebsiteAnalyticsSeriesPoint = {
  label: string;
  pageViews: number;
  visits: number;
  visitors: number;
};

export type WebsiteAnalyticsPageRow = {
  path: string;
  surface: string;
  pageViews: number;
  visits: number;
  visitors: number;
};

export type WebsiteAnalyticsReferrerRow = {
  host: string;
  visits: number;
  pageViews: number;
};

export type WebsiteAnalyticsDeviceRow = {
  device: string;
  pageViews: number;
  visits: number;
};

export type WebsiteAnalyticsBrowserRow = {
  browser: string;
  pageViews: number;
  visits: number;
};

export type WebsiteAnalyticsCountryRow = {
  code: string;
  name: string;
  pageViews: number;
  visitors: number;
};

export type WebsiteAnalytics = {
  pageViews: number;
  visits: number;
  visitors: number;
  bucket: AnalyticsBucket;
  series: WebsiteAnalyticsSeriesPoint[];
  pages: WebsiteAnalyticsPageRow[];
  referrers: WebsiteAnalyticsReferrerRow[];
  devices: WebsiteAnalyticsDeviceRow[];
  browsers: WebsiteAnalyticsBrowserRow[];
  countries: WebsiteAnalyticsCountryRow[];
  facets: {
    devices: string[];
    browsers: string[];
    surfaces: string[];
    countries: { code: string; name: string }[];
  };
  from: string;
  to: string;
};

export type ProductUsageSeriesPoint = {
  label: string;
  count: number;
};

export type ProductUsageModuleRow = {
  moduleId: string;
  views: number;
  users: number;
  restaurants: number;
};

export type ProductUsageMethodRow = {
  method: string;
  count: number;
};

export type ProductUsageUserRow = {
  profileId: string;
  name: string;
  email: string | null;
  logins: number;
  moduleViews: number;
  restaurantCount: number;
  topModule: string | null;
  lastAt: string | null;
};

export type ProductUsageRestaurantRow = {
  restaurantId: string;
  name: string;
  users: number;
  moduleViews: number;
  logins: number;
  topModule: string | null;
  lastAt: string | null;
};

export type ProductUsageAnalytics = {
  activeUsers: number;
  activeRestaurants: number;
  logins: number;
  moduleViews: number;
  bucket: AnalyticsBucket;
  loginSeries: ProductUsageSeriesPoint[];
  moduleSeries: ProductUsageSeriesPoint[];
  modules: ProductUsageModuleRow[];
  loginMethods: ProductUsageMethodRow[];
  users: ProductUsageUserRow[];
  restaurants: ProductUsageRestaurantRow[];
  facets: {
    modules: string[];
    restaurants: { id: string; name: string }[];
  };
  from: string;
  to: string;
};

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function emptyWebsiteAnalytics(from: string, to: string): WebsiteAnalytics {
  return {
    pageViews: 0,
    visits: 0,
    visitors: 0,
    bucket: "day",
    series: [],
    pages: [],
    referrers: [],
    devices: [],
    browsers: [],
    countries: [],
    facets: { devices: [], browsers: [], surfaces: [], countries: [] },
    from,
    to,
  };
}

export function emptyProductUsage(from: string, to: string): ProductUsageAnalytics {
  return {
    activeUsers: 0,
    activeRestaurants: 0,
    logins: 0,
    moduleViews: 0,
    bucket: "day",
    loginSeries: [],
    moduleSeries: [],
    modules: [],
    loginMethods: [],
    users: [],
    restaurants: [],
    facets: { modules: [], restaurants: [] },
    from,
    to,
  };
}

export function parseWebsiteAnalytics(
  raw: unknown,
  from: string,
  to: string,
): WebsiteAnalytics {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const facets =
    row.facets && typeof row.facets === "object"
      ? (row.facets as Record<string, unknown>)
      : {};
  return {
    pageViews: num(row.pageViews),
    visits: num(row.visits),
    visitors: num(row.visitors),
    bucket: row.bucket === "hour" ? "hour" : "day",
    series: list(row.series).map((item) => {
      const point = item as Record<string, unknown>;
      return {
        label: str(point.label),
        pageViews: num(point.pageViews),
        visits: num(point.visits),
        visitors: num(point.visitors),
      };
    }),
    pages: list(row.pages).map((item) => {
      const point = item as Record<string, unknown>;
      return {
        path: str(point.path),
        surface: str(point.surface),
        pageViews: num(point.pageViews),
        visits: num(point.visits),
        visitors: num(point.visitors),
      };
    }),
    referrers: list(row.referrers).map((item) => {
      const point = item as Record<string, unknown>;
      return {
        host: str(point.host),
        visits: num(point.visits),
        pageViews: num(point.pageViews),
      };
    }),
    devices: list(row.devices).map((item) => {
      const point = item as Record<string, unknown>;
      return {
        device: str(point.device),
        pageViews: num(point.pageViews),
        visits: num(point.visits),
      };
    }),
    browsers: list(row.browsers).map((item) => {
      const point = item as Record<string, unknown>;
      return {
        browser: str(point.browser),
        pageViews: num(point.pageViews),
        visits: num(point.visits),
      };
    }),
    countries: list(row.countries).map((item) => {
      const point = item as Record<string, unknown>;
      return {
        code: str(point.code),
        name: str(point.name) || "Unbekannt",
        pageViews: num(point.pageViews),
        visitors: num(point.visitors),
      };
    }),
    facets: {
      devices: list(facets.devices).map((item) => str(item)).filter(Boolean),
      browsers: list(facets.browsers).map((item) => str(item)).filter(Boolean),
      surfaces: list(facets.surfaces).map((item) => str(item)).filter(Boolean),
      countries: list(facets.countries).map((item) => {
        const point = item as Record<string, unknown>;
        return { code: str(point.code), name: str(point.name) || "Unbekannt" };
      }),
    },
    from,
    to,
  };
}

export function parseProductUsage(
  raw: unknown,
  from: string,
  to: string,
): ProductUsageAnalytics {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const facets =
    row.facets && typeof row.facets === "object"
      ? (row.facets as Record<string, unknown>)
      : {};
  const series = (value: unknown) =>
    list(value).map((item) => {
      const point = item as Record<string, unknown>;
      return { label: str(point.label), count: num(point.count) };
    });
  return {
    activeUsers: num(row.activeUsers),
    activeRestaurants: num(row.activeRestaurants),
    logins: num(row.logins),
    moduleViews: num(row.moduleViews),
    bucket: row.bucket === "hour" ? "hour" : "day",
    loginSeries: series(row.loginSeries),
    moduleSeries: series(row.moduleSeries),
    modules: list(row.modules).map((item) => {
      const point = item as Record<string, unknown>;
      return {
        moduleId: str(point.moduleId),
        views: num(point.views),
        users: num(point.users),
        restaurants: num(point.restaurants),
      };
    }),
    loginMethods: list(row.loginMethods).map((item) => {
      const point = item as Record<string, unknown>;
      return { method: str(point.method), count: num(point.count) };
    }),
    users: list(row.users).map((item) => {
      const point = item as Record<string, unknown>;
      return {
        profileId: str(point.profileId),
        name: str(point.name) || "Unbekannt",
        email: strOrNull(point.email),
        logins: num(point.logins),
        moduleViews: num(point.moduleViews),
        restaurantCount: num(point.restaurantCount),
        topModule: strOrNull(point.topModule),
        lastAt: strOrNull(point.lastAt),
      };
    }),
    restaurants: list(row.restaurants).map((item) => {
      const point = item as Record<string, unknown>;
      return {
        restaurantId: str(point.restaurantId),
        name: str(point.name) || "Restaurant",
        users: num(point.users),
        moduleViews: num(point.moduleViews),
        logins: num(point.logins),
        topModule: strOrNull(point.topModule),
        lastAt: strOrNull(point.lastAt),
      };
    }),
    facets: {
      modules: list(facets.modules).map((item) => str(item)).filter(Boolean),
      restaurants: list(facets.restaurants).map((item) => {
        const point = item as Record<string, unknown>;
        return { id: str(point.id), name: str(point.name) || "Restaurant" };
      }),
    },
    from,
    to,
  };
}

export function isAnalyticsSchemaMissing(message: string): boolean {
  return /platform_website_analytics|platform_product_usage|platform_page_views|platform_usage_events|does not exist|schema cache|PGRST202|42883/i.test(
    message,
  );
}
