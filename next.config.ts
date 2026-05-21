import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";

// Explizit dieselbe Ladereihenfolge wie Next (dev → .env.local + .env.development*;
// production → .env.local + .env.production*). Siehe .env.example.
const projectDir = process.cwd();
loadEnvConfig(projectDir);

const supabaseUpstream = process.env.SUPABASE_UPSTREAM_URL?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    if (!supabaseUpstream) return [];
    return [
      {
        source: "/sb/:path*",
        destination: `${supabaseUpstream}/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "http",
        hostname: "95.111.229.250",
        port: "8001",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
