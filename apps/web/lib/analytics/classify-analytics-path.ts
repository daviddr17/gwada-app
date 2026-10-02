import { SIDEBAR_MODULE_DEFINITIONS } from "@/lib/constants/sidebar-modules";

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

const STATIC_EXT_RE =
  /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|txt|xml|json|woff2?|webmanifest)$/i;

const PRODUCT_EXCLUDED_PREFIXES = ["/superadmin", "/display", "/api", "/embed"];

export const WEBSITE_SURFACES = [
  "marketing",
  "docs",
  "legal",
  "auth",
  "newsletter",
  "embed",
  "review",
  "public_site",
  "other",
] as const;

export type WebsiteSurface = (typeof WEBSITE_SURFACES)[number];

export function normalizeAnalyticsPath(input: string): string | null {
  const raw = input.trim();
  if (!raw.startsWith("/")) return null;
  const cut = raw.split(/[?#]/, 1)[0] ?? "";
  if (!cut.startsWith("/")) return null;
  if (cut.includes("\\") || cut.includes("\0") || cut.includes("..")) return null;
  const collapsed = cut.replace(/\/{2,}/g, "/");
  const trimmed = collapsed.length > 1 ? collapsed.replace(/\/+$/, "") : collapsed;
  if (!trimmed.startsWith("/") || trimmed.length > 300) return null;
  return trimmed;
}

/** Pfade ohne Query. Einladungs-Tokens und UUIDs werden nicht roh gespeichert. */
export function redactAnalyticsPath(path: string): string {
  if (path === "/invitation" || path.startsWith("/invitation/")) return "/invitation";
  if (path.startsWith("/auth/callback")) return "/auth/callback";
  if (path.startsWith("/auth/new-password")) return "/auth/new-password";
  const withoutUuid = path.replace(UUID_RE, ":id");
  return withoutUuid
    .split("/")
    .map((segment) => {
      if (segment === ":id" || segment.length < 20) return segment;
      if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(segment)) return segment;
      if (/^[A-Za-z0-9_-]{20,}$/.test(segment)) return ":token";
      return segment;
    })
    .join("/");
}

function isStaticAssetPath(path: string): boolean {
  return STATIC_EXT_RE.test(path);
}

export function websiteSurface(path: string): WebsiteSurface {
  if (path === "/") return "marketing";
  if (path === "/docs" || path.startsWith("/docs/")) return "docs";
  if (
    path === "/privacy" ||
    path === "/terms" ||
    path === "/imprint" ||
    path === "/dpa" ||
    path === "/data-deletion" ||
    path.startsWith("/privacy/") ||
    path.startsWith("/terms/") ||
    path.startsWith("/imprint/") ||
    path.startsWith("/dpa/") ||
    path.startsWith("/data-deletion/")
  ) {
    return "legal";
  }
  if (
    path === "/login" ||
    path.startsWith("/login/") ||
    path === "/auth" ||
    path.startsWith("/auth/") ||
    path === "/invitation" ||
    path.startsWith("/invitation/")
  ) {
    return "auth";
  }
  if (path === "/newsletter" || path.startsWith("/newsletter/")) return "newsletter";
  if (path === "/embed" || path.startsWith("/embed/")) return "embed";
  if (path === "/review" || path.startsWith("/review/")) return "review";
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 1) return "public_site";
  return "other";
}

function isProductArea(path: string): boolean {
  if (path === "/dashboard" || path.startsWith("/dashboard/")) return true;
  if (path === "/workspace" || path.startsWith("/workspace/")) return true;
  if (path === "/profile" || path.startsWith("/profile/")) return true;
  if (path === "/changelog" || path.startsWith("/changelog/")) return true;
  return false;
}

export function websiteAnalyticsTarget(
  pathname: string,
): { path: string; surface: WebsiteSurface } | null {
  const path = normalizeAnalyticsPath(pathname);
  if (!path || isStaticAssetPath(path) || isProductArea(path)) return null;
  if (
    path === "/superadmin" ||
    path.startsWith("/superadmin/") ||
    path === "/display" ||
    path.startsWith("/display/") ||
    path === "/api" ||
    path.startsWith("/api/") ||
    path === "/zone" ||
    path.startsWith("/zone/") ||
    path === "/_next" ||
    path.startsWith("/_next/")
  ) {
    return null;
  }
  return { path: redactAnalyticsPath(path), surface: websiteSurface(path) };
}

export function productUsageTarget(
  pathname: string,
): { moduleId: string; path: string } | null {
  const path = normalizeAnalyticsPath(pathname);
  if (!path || isStaticAssetPath(path)) return null;
  if (PRODUCT_EXCLUDED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return null;
  }

  if (path === "/dashboard") {
    return { moduleId: "dashboard", path: "/dashboard" };
  }
  if (path === "/dashboard/changelog" || path.startsWith("/dashboard/changelog/")) {
    return { moduleId: "changelog", path: redactAnalyticsPath(path) };
  }
  if (path === "/dashboard/settings" || path.startsWith("/dashboard/settings/")) {
    return { moduleId: "einstellungen", path: redactAnalyticsPath(path) };
  }
  for (const mod of SIDEBAR_MODULE_DEFINITIONS) {
    if (path === mod.pathPrefix || path.startsWith(`${mod.pathPrefix}/`)) {
      return { moduleId: mod.id, path: redactAnalyticsPath(path) };
    }
  }
  if (path === "/workspace" || path.startsWith("/workspace/")) {
    return { moduleId: "workspace", path: redactAnalyticsPath(path) };
  }
  if (path === "/profile" || path.startsWith("/profile/")) {
    return { moduleId: "profil", path: redactAnalyticsPath(path) };
  }
  if (path === "/changelog" || path.startsWith("/changelog/")) {
    return { moduleId: "changelog", path: redactAnalyticsPath(path) };
  }
  return null;
}
