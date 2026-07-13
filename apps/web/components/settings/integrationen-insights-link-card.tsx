"use client";

import Link from "next/link";
import { ArrowRight, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

export function IntegrationenInsightsLinkCard() {
  return (
    <Card className="overflow-hidden border-border/50 shadow-card">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <BarChart3 className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold tracking-tight">Insights</p>
            <p className="text-xs text-muted-foreground">
              Google Business Aufrufe &amp; Klicks, Facebook-/Instagram-Reichweite
              und Gwada-KPIs — Reservierungen, Bewertungen, Nachrichten und News.
            </p>
          </div>
        </div>
        <Link
          href={APP_ROUTES.insights.overview}
          className={cn(
            "inline-flex h-9 items-center justify-center gap-2 px-4 text-sm",
            brandActionButtonRoundedClassName,
          )}
        >
          Insights öffnen
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  );
}
