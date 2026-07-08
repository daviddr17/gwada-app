import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import { LEGACY_MODULE_REDIRECTS } from "./lib/navigation/app-routes";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.join(appRoot, "../..");

// Explizit dieselbe Ladereihenfolge wie Next (dev → .env.local + .env.development*;
// production → .env.local + .env.production*). Siehe .env.example.
const projectDir = process.cwd();
loadEnvConfig(projectDir);

/** Hostnames für Production-Image-Optimizer via remotePatterns. */
const gwadaAppStorageHostnames = ["new.gwada.app", "gwada.app"] as const;

const supabaseStoragePatterns = [
  {
    protocol: "https" as const,
    hostname: "**.supabase.co",
    pathname: "/storage/v1/object/**",
  },
  ...gwadaAppStorageHostnames.map((hostname) => ({
    protocol: "https" as const,
    hostname,
    pathname: "/sb/storage/v1/object/**",
  })),
  {
    protocol: "http" as const,
    hostname: "127.0.0.1",
    port: "54321",
    pathname: "/storage/v1/object/**",
  },
  {
    protocol: "http" as const,
    hostname: "localhost",
    port: "54321",
    pathname: "/storage/v1/object/**",
  },
  {
    protocol: "http" as const,
    hostname: "95.111.229.250",
    port: "8001",
    pathname: "/storage/v1/object/**",
  },
  {
    protocol: "http" as const,
    hostname: "95.111.229.250",
    port: "8100",
    pathname: "/storage/v1/object/**",
  },
  {
    protocol: "http" as const,
    hostname: "95.111.229.250",
    port: "3000",
    pathname: "/sb/storage/v1/object/**",
  },
];

const nextConfig: NextConfig = {
  // Dev unter http://127.0.0.1:3000 (statt localhost) — HMR/Dev-Ressourcen erlauben.
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@gwada/shared", "@gwada/pos-domain", "@gwada/supabase"],
  // pdfkit is Node/CJS-only — avoid Turbopack wrapping the constructor export.
  serverExternalPackages: ["pdfkit"],
  // Docker/standalone (next build): Monorepo-Root — nicht in dev setzen, sonst überschreibt
  // Next turbopack.root und indexiert apps/staff → „Compiling /“ hängt.
  ...(process.env.NODE_ENV === "production"
    ? { outputFileTracingRoot: monorepoRoot }
    : {}),
  turbopack: {
    // pnpm-Monorepo: node_modules am Repo-Root; in dev kein outputFileTracingRoot (s. o.).
    root: monorepoRoot,
  },
  images: {
    localPatterns: [
      {
        pathname: "/api/platform/logo",
      },
      {
        pathname: "/api/platform/branding-asset",
      },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      ...supabaseStoragePatterns,
    ],
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/favicon.ico",
          destination: "/api/platform/favicon",
        },
      ],
    };
  },
  async redirects() {
    return LEGACY_MODULE_REDIRECTS.map(({ source, destination }) => ({
      source,
      destination,
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        source: "/display/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/display/",
          },
        ],
      },
      {
        source: "/embed/v1/gwada.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
      {
        source: "/embed/v1/gwada-resize.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
        ],
      },
      {
        source: "/embed/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=60, stale-while-revalidate=300",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
