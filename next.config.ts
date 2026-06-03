import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";

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
    pathname: "/storage/v1/object/public/**",
  },
  ...gwadaAppStorageHostnames.map((hostname) => ({
    protocol: "https" as const,
    hostname,
    pathname: "/sb/storage/v1/object/public/**",
  })),
  {
    protocol: "http" as const,
    hostname: "127.0.0.1",
    port: "54321",
    pathname: "/storage/v1/object/public/**",
  },
  {
    protocol: "http" as const,
    hostname: "95.111.229.250",
    port: "8001",
    pathname: "/storage/v1/object/public/**",
  },
  {
    protocol: "http" as const,
    hostname: "95.111.229.250",
    port: "3000",
    pathname: "/sb/storage/v1/object/public/**",
  },
];

const nextConfig: NextConfig = {
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
