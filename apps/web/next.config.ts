import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Monorepo: Env-Dateien weiterhin am Repo-Root (.env.local), optional zusätzlich in apps/web.
const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "../..");
loadEnvConfig(repoRoot);
loadEnvConfig(appDir);

/** Dev only: Staff-App / Gerät im LAN (HMR, webpack-hmr). Siehe allowedDevOrigins in next.config. */
function buildAllowedDevOrigins(): string[] {
  const origins = new Set<string>([
    "localhost",
    "127.0.0.1",
    "192.168.*.*",
    "10.*.*.*",
    "172.*.*.*",
  ]);

  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        origins.add(iface.address);
      }
    }
  }

  const extra = process.env.GWADA_ALLOWED_DEV_ORIGINS?.trim();
  if (extra) {
    for (const item of extra.split(",")) {
      const host = item.trim();
      if (host) origins.add(host);
    }
  }

  return [...origins];
}

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
    port: "3000",
    pathname: "/sb/storage/v1/object/**",
  },
];

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV !== "production"
    ? { allowedDevOrigins: buildAllowedDevOrigins() }
    : {}),
  transpilePackages: ["@gwada/shared", "@gwada/pos-domain", "@gwada/supabase"],
  serverExternalPackages: ["pdfkit"],
  turbopack: {
    root: repoRoot,
  },
  images: {
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
  async headers() {
    return [
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
