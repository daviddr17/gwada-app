"use client";

import Link from "next/link";
import type { RestaurantApiModuleId } from "@/lib/api/restaurant-api-modules";
import { restaurantApiModuleById } from "@/lib/api/restaurant-api-modules";
import { cn } from "@/lib/utils";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

export function restaurantPublicApiBaseUrl(origin?: string): string {
  const base = (origin ?? "").replace(/\/+$/, "");
  return `${base}/api/v1`;
}

export function restaurantPublicApiModuleUrl(
  moduleId: RestaurantApiModuleId,
  origin?: string,
): string {
  const meta = restaurantApiModuleById(moduleId);
  if (!meta) return restaurantPublicApiBaseUrl(origin);
  return `${restaurantPublicApiBaseUrl(origin)}/${meta.path}`;
}

type EmbedApiInfoCardProps = {
  moduleId: RestaurantApiModuleId;
  className?: string;
};

export function EmbedApiInfoCard({ moduleId, className }: EmbedApiInfoCardProps) {
  const meta = restaurantApiModuleById(moduleId);
  if (!meta) return null;

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://gwada.app";
  const endpoint = restaurantPublicApiModuleUrl(moduleId, origin);
  const example = `curl -s "${endpoint}" \\
  -H "Authorization: Bearer IHR_API_SCHLÜSSEL"`;

  return (
    <section
      className={cn(
        "space-y-3 rounded-2xl border border-border/50 bg-muted/15 p-5 shadow-card",
        className,
      )}
    >
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Headless per API</h2>
        <p className="text-sm text-muted-foreground">
          JSON-Daten für {meta.label} mit eigenem Design — ohne iframe. Schlüssel
          zentral unter Einstellungen verwalten.
        </p>
      </div>

      <div className="rounded-xl border border-border/50 bg-background/80 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Endpunkt
        </p>
        <code className="mt-1 block break-all text-sm">{endpoint}</code>
      </div>

      <pre className="overflow-x-auto rounded-xl border border-border/50 bg-background/80 p-3 text-xs leading-relaxed text-muted-foreground">
        {example}
      </pre>

      <div className="flex flex-wrap gap-2">
        <Link
          href={APP_ROUTES.settings.api}
          className="inline-flex h-9 items-center rounded-lg border border-border/60 bg-background px-3 text-sm font-medium hover:bg-muted/30"
        >
          API-Schlüssel verwalten
        </Link>
        <Link
          href={meta.docsPath}
          className="inline-flex h-9 items-center rounded-lg border border-border/60 bg-background px-3 text-sm font-medium hover:bg-muted/30"
        >
          API-Dokumentation
        </Link>
        <Link
          href="/docs/api"
          className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Alle Module
        </Link>
      </div>
    </section>
  );
}
