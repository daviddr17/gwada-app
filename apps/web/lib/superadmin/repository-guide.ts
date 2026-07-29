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
        path: "apps/web/",
        description: "Next.js Web-App (App Router, API-Routes, UI)",
      },
      {
        path: "packages/",
        description: "Geteilte Workspace-Pakete (Monorepo)",
      },
      {
        path: "supabase/migrations/",
        description: "Postgres-Schema — Dev: pnpm db:push · Live: deploy-live-db",
      },
      {
        path: ".github/workflows/",
        description:
          "deploy-live-app/db, reboot-live-vps, update-waha-live (SSH)",
      },
      {
        path: "scripts/",
        description: "Deploy-, DB- und WAHA-Hilfsskripte (CI/lokal)",
      },
      {
        path: "docs/",
        description: "Live-Deploy, Remote-Dev-Supabase, Domains, Cron",
      },
    ],
    docLinks: [
      {
        label: "Live-App deployen",
        path: "docs/coolify-live-deploy.md",
      },
      {
        label: "Remote-Dev-Supabase",
        path: "docs/remote-dev-supabase.md",
      },
      {
        label: "GitHub App Deploy-Auth",
        path: "docs/github-app-deploy-auth.md",
      },
      {
        label: "Live-Deploy Kurzreferenz",
        path: "docs/live-deploy.md",
      },
    ],
  };
}
