import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const superadminRoot = fileURLToPath(new URL(".", import.meta.url));
const webRoot = path.resolve(superadminRoot, "../web");
const monorepoRoot = path.resolve(superadminRoot, "../../..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, monorepoRoot, "");
  const apiOrigin = env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";

  return {
    plugins: [react(), tailwindcss()],
    base: "/superadmin-spa/",
    resolve: {
      alias: {
        "@": webRoot,
        "next/navigation": path.resolve(
          webRoot,
          "lib/navigation/spa-next-shims/next-navigation.tsx",
        ),
        "next/link": path.resolve(
          webRoot,
          "lib/navigation/spa-next-shims/next-link.tsx",
        ),
        "next/image": path.resolve(
          superadminRoot,
          "src/shims/next-image.tsx",
        ),
        "@/components/providers/soft-nav-lock-provider": path.resolve(
          superadminRoot,
          "src/shims/soft-nav-lock-provider.tsx",
        ),
        crypto: path.resolve(superadminRoot, "src/shims/crypto.ts"),
      },
    },
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        "/api": { target: apiOrigin, changeOrigin: true },
        "/auth": { target: apiOrigin, changeOrigin: true },
        "/sb": { target: apiOrigin, changeOrigin: true },
      },
    },
    build: {
      outDir: path.resolve(webRoot, "public/superadmin-spa"),
      emptyOutDir: true,
      manifest: true,
      rollupOptions: {
        input: path.resolve(superadminRoot, "index.html"),
      },
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode),
    },
  };
});
