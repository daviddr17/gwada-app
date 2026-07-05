import type { SuperadminRepositoryGuide } from "@/lib/types/superadmin-ops-status";

export function buildRepositoryGuide(input: {
  repoSlug: string;
  defaultBranch: string;
}): SuperadminRepositoryGuide {
  const repoUrl = `https://github.com/${input.repoSlug}`;

  return {
    repoSlug: input.repoSlug,
    repoUrl,
    defaultBranch: input.defaultBranch,
    tree: [
      {
        path: "app/",
        description: "Next.js App Router — Seiten, Layouts, Route Handlers",
      },
      {
        path: "components/",
        description: "UI-Bausteine (shadcn), Modul-Screens, Superadmin",
      },
      {
        path: "lib/",
        description: "Server-/Client-Logik, Hooks, Supabase, Integrationen",
      },
      {
        path: "supabase/migrations/",
        description: "Postgres-Schema — lokal pushen, live via GitHub Action",
      },
      {
        path: ".github/workflows/",
        description: "deploy-live-app.yml + deploy-live-db.yml (SSH → VPS)",
      },
      {
        path: "docs/",
        description: "Deploy, Supabase lokal/live, Staging-Domain",
      },
      {
        path: "proxy.ts",
        description: "Edge-Proxy, öffentliche Slugs, Auth-Routing",
      },
    ],
    docLinks: [
      {
        label: "Live-App deployen",
        path: "docs/coolify-live-deploy.md",
      },
      {
        label: "Supabase lokal & live",
        path: "docs/supabase-lokal-und-live.md",
      },
      {
        label: "Production gwada.app",
        path: "docs/new-gwada-app-staging.md",
      },
      {
        label: "Live-Deploy Kurzreferenz",
        path: "docs/live-deploy.md",
      },
    ],
  };
}
