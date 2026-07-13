"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  Eye,
  Globe,
  Link2,
  MapPinned,
  MessageCircle,
  MousePointerClick,
  Navigation,
  Newspaper,
  Phone,
  Search,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { AppleGlyph } from "@/components/icons/apple-glyph";
import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { InstagramGlyph } from "@/components/icons/instagram-glyph";
import { TripadvisorGlyph } from "@/components/icons/tripadvisor-glyph";
import { InsightsOverviewSkeleton } from "@/components/insights/insights-overview-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  insightsPresetRangeYmd,
  type InsightsPeriodDays,
} from "@/lib/insights/insights-date-range";
import type { InsightsOverviewPayload } from "@/lib/insights/insights-overview-server";
import { formatInsightCount } from "@/lib/insights/platform-insights-types";
import { formatReviewRating } from "@/lib/reviews/compute-review-statistics";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { cn } from "@/lib/utils";
import Link from "next/link";

const PERIOD_OPTIONS: { days: InsightsPeriodDays; label: string }[] = [
  { days: 7, label: "7 Tage" },
  { days: 30, label: "30 Tage" },
  { days: 90, label: "90 Tage" },
];

type InsightsPeriodSelection =
  | { mode: "preset"; days: InsightsPeriodDays }
  | { mode: "custom"; startYmd: string; endYmd: string };

function PlatformGlyph({
  id,
}: {
  id: InsightsOverviewPayload["platforms"][number]["id"];
}) {
  const className = "size-5 shrink-0";
  if (id === "google_business") return <GoogleGlyph className={className} />;
  if (id === "facebook") return <FacebookGlyph className={className} />;
  if (id === "instagram") return <InstagramGlyph className={className} />;
  if (id === "apple_business_connect") return <AppleGlyph className={className} />;
  return <TripadvisorGlyph className={className} />;
}

function buildOverviewParams(
  restaurantId: string,
  selection: InsightsPeriodSelection,
): URLSearchParams {
  const params = new URLSearchParams({ restaurantId });
  if (selection.mode === "preset") {
    params.set("periodDays", String(selection.days));
  } else {
    params.set("startYmd", selection.startYmd);
    params.set("endYmd", selection.endYmd);
  }
  return params;
}

export function InsightsOverviewScreen() {
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const [periodSelection, setPeriodSelection] = useState<InsightsPeriodSelection>(
    () => ({ mode: "preset", days: 30 }),
  );
  const [data, setData] = useState<InsightsOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading && !data);

  const customRangeInvalid =
    periodSelection.mode === "custom" &&
    periodSelection.startYmd > periodSelection.endYmd;

  const load = useCallback(async () => {
    if (!restaurantId) {
      setData(null);
      setLoading(false);
      return;
    }
    if (customRangeInvalid) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/insights/overview?${buildOverviewParams(restaurantId, periodSelection)}`,
      );
      const body = (await res.json()) as InsightsOverviewPayload & {
        error?: string;
      };
      if (!res.ok) {
        toast.error(
          body.error === "invalid_date_range"
            ? "Ungültiger Zeitraum — Enddatum muss am oder nach dem Startdatum liegen."
            : body.error ?? "Insights konnten nicht geladen werden.",
        );
        setLoading(false);
        return;
      }
      setData(body);
    } catch {
      toast.error("Netzwerkfehler beim Laden der Insights.");
    }
    setLoading(false);
  }, [restaurantId, periodSelection, customRangeInvalid]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!supabaseEnvOk) {
    return (
      <p className="text-sm text-muted-foreground">
        Supabase-Umgebungsvariablen fehlen.
      </p>
    );
  }

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }

  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  if (showSkeleton) {
    return <InsightsOverviewSkeleton />;
  }

  const reservations = data?.gwada.reservations;
  const reviews = data?.gwada.reviews;
  const messages = data?.gwada.messages;
  const news = data?.gwada.news;
  const google = data?.google;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-end gap-3">
        <div
          className="flex flex-wrap justify-end gap-1 rounded-xl border border-border/50 bg-muted/30 p-1"
          role="group"
          aria-label="Zeitraum"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <Button
              key={opt.days}
              type="button"
              size="sm"
              variant={
                periodSelection.mode === "preset" &&
                periodSelection.days === opt.days
                  ? "default"
                  : "ghost"
              }
              className={cn(
                "h-8 rounded-lg px-3 text-xs",
                periodSelection.mode === "preset" &&
                  periodSelection.days === opt.days &&
                  "shadow-sm",
              )}
              onClick={() =>
                setPeriodSelection({ mode: "preset", days: opt.days })
              }
            >
              {opt.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={periodSelection.mode === "custom" ? "default" : "ghost"}
            className={cn(
              "h-8 rounded-lg px-3 text-xs",
              periodSelection.mode === "custom" && "shadow-sm",
            )}
            onClick={() =>
              setPeriodSelection((current) => {
                if (current.mode === "custom") return current;
                const range = insightsPresetRangeYmd(
                  current.mode === "preset" ? current.days : 30,
                );
                return {
                  mode: "custom",
                  startYmd: range.startYmd,
                  endYmd: range.endYmd,
                };
              })
            }
          >
            Frei
          </Button>
        </div>

        {periodSelection.mode === "custom" ? (
          <div className="grid w-full max-w-md gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="insights-range-start">Von</Label>
              <DatePickerField
                id="insights-range-start"
                value={periodSelection.startYmd}
                onChange={(v) => {
                  if (!v) return;
                  setPeriodSelection({
                    mode: "custom",
                    startYmd: v,
                    endYmd: periodSelection.endYmd,
                  });
                }}
                fullWidth
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="insights-range-end">Bis</Label>
              <DatePickerField
                id="insights-range-end"
                value={periodSelection.endYmd}
                onChange={(v) => {
                  if (!v) return;
                  setPeriodSelection({
                    mode: "custom",
                    startYmd: periodSelection.startYmd,
                    endYmd: v,
                  });
                }}
                minYmd={periodSelection.startYmd}
                fullWidth
              />
            </div>
            {customRangeInvalid ? (
              <p className="text-sm text-destructive sm:col-span-2">
                Das Enddatum muss am oder nach dem Startdatum liegen.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <section aria-label="Gwada-Kennzahlen">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Reservierungen"
            value={String(reservations?.count ?? 0)}
            hint={`${reservations?.guests ?? 0} Gäste im Zeitraum`}
            icon={CalendarDays}
          />
          <KpiCard
            label="Neue Bewertungen"
            value={String(reviews?.count ?? 0)}
            hint={
              reviews?.avgRating != null
                ? `Ø ${formatReviewRating(reviews.avgRating)} Sterne (alle Plattformen)`
                : "Keine Bewertungen im Zeitraum"
            }
            icon={Star}
          />
          <KpiCard
            label="Eingehende Nachrichten"
            value={String(messages?.inbound ?? 0)}
            hint="WhatsApp, E-Mail, Social"
            icon={MessageCircle}
          />
          <KpiCard
            label="News-Beiträge"
            value={String(news?.published ?? 0)}
            hint={
              (news?.likes ?? 0) + (news?.comments ?? 0) > 0
                ? `${news?.likes ?? 0} Likes · ${news?.comments ?? 0} Kommentare`
                : "Veröffentlicht im Zeitraum"
            }
            icon={Newspaper}
          />
        </div>
      </section>

      {google?.connected ? (
        <section aria-label="Google Business Performance" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <GoogleGlyph className="size-4" />
                Google Business Performance
              </h2>
              <p className="text-xs text-muted-foreground">
                Aufrufe, Anrufe und Interaktionen am Google-Profil
                {google.error ? ` — ${google.error}` : " (oft 2–3 Tage Verzug)."}
              </p>
            </div>
            <Link
              href={APP_ROUTES.insights.statistics}
              className="text-xs font-medium text-accent hover:underline"
            >
              Tages-Charts
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={Eye}
              label="Aufrufe gesamt"
              value={formatInsightCount(google.impressions)}
              hint={`${formatInsightCount(google.searchImpressions)} Suche · ${formatInsightCount(google.mapsImpressions)} Maps`}
            />
            <KpiCard
              icon={MousePointerClick}
              label="Interaktionen"
              value={formatInsightCount(google.interactions)}
              hint="Anrufe, Website, Routen, Chat, Buchungen, Menü"
            />
            <KpiCard
              icon={Search}
              label="Suchaufrufe"
              value={formatInsightCount(google.searchImpressions)}
              hint="Google Suche Desktop + Mobile"
            />
            <KpiCard
              icon={MapPinned}
              label="Maps-Aufrufe"
              value={formatInsightCount(google.mapsImpressions)}
              hint="Google Maps Desktop + Mobile"
            />
            <KpiCard
              icon={Phone}
              label="Anrufe"
              value={formatInsightCount(google.callClicks)}
              hint="Klicks auf Anrufen"
            />
            <KpiCard
              icon={Globe}
              label="Website-Klicks"
              value={formatInsightCount(google.websiteClicks)}
              hint="Klicks auf die Website"
            />
            <KpiCard
              icon={Navigation}
              label="Wegbeschreibungen"
              value={formatInsightCount(google.directionRequests)}
              hint="Routenanfragen"
            />
            <KpiCard
              icon={MessageCircle}
              label="Nachrichten & mehr"
              value={formatInsightCount(
                google.conversations + google.bookings + google.menuClicks,
              )}
              hint={`${formatInsightCount(google.conversations)} Chat · ${formatInsightCount(google.bookings)} Buchungen · ${formatInsightCount(google.menuClicks)} Menü`}
            />
          </div>
        </section>
      ) : null}

      <section aria-label="Plattform-Verbindungen" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">
              Plattformen
            </h2>
            <p className="text-xs text-muted-foreground">
              Verbindungsstatus und Kennzahlen — Charts unter Insights → Statistiken
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={APP_ROUTES.insights.statistics}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              Statistiken
            </Link>
            <Link
              href={APP_ROUTES.settings.integrations}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-accent hover:underline"
            >
              <Link2 className="size-3.5" aria-hidden />
              Integrationen
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {(data?.platforms ?? []).map((platform) => (
            <Card
              key={platform.id}
              className={cn(
                "border-border/50 shadow-card transition-colors",
                platform.connected && "border-accent/20",
              )}
            >
              <CardContent className="flex gap-3 p-4">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    platform.connected
                      ? "bg-accent/10 text-accent"
                      : "bg-muted/40 text-muted-foreground",
                  )}
                >
                  <PlatformGlyph id={platform.id} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{platform.label}</p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        platform.connected
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {platform.connected ? "Verbunden" : "Nicht verbunden"}
                    </span>
                    {platform.insightsAvailable ? (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                        Daten verfügbar
                      </span>
                    ) : null}
                  </div>
                  {platform.metrics.length > 0 ? (
                    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {platform.metrics.map((metric) => (
                        <div key={metric.label} className="min-w-0">
                          <dt className="text-[10px] text-muted-foreground">
                            {metric.label}
                          </dt>
                          <dd className="text-sm font-medium tabular-nums">
                            {metric.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {platform.hint}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {(data?.platforms ?? []).length === 0 ? (
          <Card className="border-border/50 shadow-card">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Keine Plattform-Integrationen freigeschaltet.{" "}
              <Link
                href={APP_ROUTES.settings.integrations}
                className="font-medium text-accent hover:underline"
              >
                Integrationen öffnen
              </Link>
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
