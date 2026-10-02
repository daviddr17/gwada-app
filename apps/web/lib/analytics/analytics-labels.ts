import {
  SIDEBAR_MODULE_DEFINITIONS,
  isSidebarModuleId,
} from "@/lib/constants/sidebar-modules";
import type { AnalyticsRange } from "@/lib/analytics/analytics-range";
import { WEBSITE_SURFACES, type WebsiteSurface } from "@/lib/analytics/classify-analytics-path";

const countFormat = new Intl.NumberFormat("de-DE");
const ratioFormat = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const dateTimeFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatAnalyticsCount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return countFormat.format(Math.round(value));
}

export function formatPagesPerVisit(pageViews: number, visits: number): string {
  if (visits <= 0) return "—";
  return ratioFormat.format(pageViews / visits);
}

export function formatAnalyticsDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormat.format(date);
}

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  today: "Heute",
  "7d": "Letzte 7 Tage",
  "30d": "Letzte 30 Tage",
  "90d": "Letzte 90 Tage",
};

export const ANALYTICS_RANGE_OPTIONS = (
  Object.entries(RANGE_LABELS) as [AnalyticsRange, string][]
).map(([value, label]) => ({ value, label }));

export function analyticsRangeLabel(range: AnalyticsRange): string {
  return RANGE_LABELS[range];
}

const DEVICE_LABELS: Record<string, string> = {
  desktop: "Desktop",
  mobile: "Mobil",
  tablet: "Tablet",
  unknown: "Unbekannt",
};

const BROWSER_LABELS: Record<string, string> = {
  chrome: "Chrome",
  safari: "Safari",
  firefox: "Firefox",
  edge: "Edge",
  opera: "Opera",
  samsung: "Samsung Internet",
  other: "Sonstige",
  unknown: "Unbekannt",
};

const SURFACE_LABELS: Record<WebsiteSurface, string> = {
  marketing: "Marketing",
  docs: "Docs",
  legal: "Rechtliches",
  auth: "Anmeldung",
  newsletter: "Newsletter",
  embed: "Embed",
  review: "Bewertung",
  public_site: "Öffentliche Seite",
  other: "Sonstiges",
};

const LOGIN_METHOD_LABELS: Record<string, string> = {
  password: "Passwort",
  passkey: "Passkey",
  oauth: "OAuth",
  magiclink: "Magic Link",
  otp: "Code",
  invite: "Einladung",
  recovery: "Passwort zurücksetzen",
  unknown: "Unbekannt",
};

const EXTRA_MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  einstellungen: "Einstellungen",
  workspace: "Workspace",
  profil: "Profil",
  changelog: "Changelog",
};

export function analyticsDeviceLabel(device: string): string {
  return DEVICE_LABELS[device] ?? device;
}

export function analyticsBrowserLabel(browser: string): string {
  return BROWSER_LABELS[browser] ?? browser;
}

export function analyticsSurfaceLabel(surface: string): string {
  if ((WEBSITE_SURFACES as readonly string[]).includes(surface)) {
    return SURFACE_LABELS[surface as WebsiteSurface];
  }
  return surface;
}

export function analyticsReferrerLabel(host: string): string {
  return host.trim() ? host : "Direkt";
}

export function analyticsLoginMethodLabel(method: string): string {
  return LOGIN_METHOD_LABELS[method] ?? method;
}

export function analyticsModuleLabel(moduleId: string | null | undefined): string {
  if (!moduleId) return "—";
  if (isSidebarModuleId(moduleId)) {
    return SIDEBAR_MODULE_DEFINITIONS.find((mod) => mod.id === moduleId)?.label ?? moduleId;
  }
  return EXTRA_MODULE_LABELS[moduleId] ?? moduleId;
}

export const ANALYTICS_DEVICE_OPTIONS = [
  { value: "all", label: "Alle Geräte" },
  ...Object.entries(DEVICE_LABELS).map(([value, label]) => ({ value, label })),
];

export const ANALYTICS_BROWSER_OPTIONS = [
  { value: "all", label: "Alle Browser" },
  ...Object.entries(BROWSER_LABELS).map(([value, label]) => ({ value, label })),
];

export const ANALYTICS_SURFACE_OPTIONS = [
  { value: "all", label: "Alle Bereiche" },
  ...WEBSITE_SURFACES.map((value) => ({ value, label: SURFACE_LABELS[value] })),
];

export function analyticsModuleOptions(
  extraIds: readonly string[],
): { value: string; label: string }[] {
  const seen = new Set<string>();
  const options: { value: string; label: string }[] = [
    { value: "all", label: "Alle Module" },
  ];
  const ids = [
    "dashboard",
    ...SIDEBAR_MODULE_DEFINITIONS.map((mod) => mod.id),
    "einstellungen",
    "workspace",
    "profil",
    "changelog",
    ...extraIds,
  ];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    options.push({ value: id, label: analyticsModuleLabel(id) });
  }
  return options;
}
