import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const dashboardRoot = fileURLToPath(new URL(".", import.meta.url));
const webRoot = path.resolve(dashboardRoot, "../web");
const monorepoRoot = path.resolve(dashboardRoot, "../../..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, monorepoRoot, "");
  const apiOrigin = env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";

  return {
    plugins: [react(), tailwindcss()],
    base: "/dashboard-spa/",
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
          dashboardRoot,
          "src/shims/next-image.tsx",
        ),
        "@/components/providers/soft-nav-lock-provider": path.resolve(
          dashboardRoot,
          "src/shims/soft-nav-lock-provider.tsx",
        ),
        crypto: path.resolve(dashboardRoot, "src/shims/crypto.ts"),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": { target: apiOrigin, changeOrigin: true },
        "/auth": { target: apiOrigin, changeOrigin: true },
        "/sb": { target: apiOrigin, changeOrigin: true },
      },
    },
    build: {
      outDir: path.resolve(webRoot, "public/dashboard-spa"),
      emptyOutDir: true,
      manifest: true,
      rollupOptions: {
        input: path.resolve(dashboardRoot, "index.html"),
      },
    },
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode),
    },
  };
});
