"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  Eye,
  Link2,
  MessageCircle,
  Newspaper,
  Star,
} from "lucide-react";
import { InsightsOverviewSkeleton } from "@/components/insights/insights-overview-skeleton";
import { InsightsPlatformFilterChips } from "@/components/insights/insights-platform-filter-chips";
import {
  FacebookInsightsPanels,
  GoogleInsightsPanels,
  InstagramInsightsPanels,
} from "@/components/insights/insights-platform-panels";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePickerField } from "@/components/ui/date-picker";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import {
  INSIGHTS_PLATFORM_DEFAULT,
  INSIGHTS_PLATFORM_LABELS,
  parseInsightsPlatform,
  type InsightsPlatform,
} from "@/lib/constants/insights-platforms";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  insightsPresetRangeYmd,
  type InsightsPeriodDays,
} from "@/lib/insights/insights-date-range";
import type { InsightsOverviewPayload } from "@/lib/insights/insights-overview-server";
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

function platformCard(
  data: InsightsOverviewPayload | null,
  id: InsightsPlatform,
) {
  if (id === "gwada") return null;
  return data?.platforms.find((p) => p.id === id) ?? null;
}

export function InsightsOverviewScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();

  const [platform, setPlatformState] = useState<InsightsPlatform>(() =>
    parseInsightsPlatform(searchParams.get("platform")),
  );
  const [periodSelection, setPeriodSelection] = useState<InsightsPeriodSelection>(
    () => ({ mode: "preset", days: 30 }),
  );
  const [data, setData] = useState<InsightsOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading && !data);

  const customRangeInvalid =
    periodSelection.mode === "custom" &&
    periodSelection.startYmd > periodSelection.endYmd;

  const setPlatform = useCallback(
    (next: InsightsPlatform) => {
      setPlatformState(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === INSIGHTS_PLATFORM_DEFAULT) params.delete("platform");
      else params.set("platform", next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    setPlatformState(parseInsightsPlatform(searchParams.get("platform")));
  }, [searchParams]);

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

  const availablePlatforms = useMemo(() => {
    const set = new Set<InsightsPlatform>(["gwada"]);
    for (const card of data?.platforms ?? []) {
      if (
        card.id === "google_business" ||
        card.id === "facebook" ||
        card.id === "instagram" ||
        card.id === "tripadvisor"
      ) {
        set.add(card.id);
      }
    }
    return set;
  }, [data?.platforms]);

  useEffect(() => {
    if (!data) return;
    if (!availablePlatforms.has(platform)) {
      setPlatform(INSIGHTS_PLATFORM_DEFAULT);
    }
  }, [data, availablePlatforms, platform, setPlatform]);

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
  const facebook = data?.facebook;
  const instagram = data?.instagram;
  const tripCard = platformCard(data, "tripadvisor");
  const googleCard = platformCard(data, "google_business");
  const fbCard = platformCard(data, "facebook");
  const igCard = platformCard(data, "instagram");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <InsightsPlatformFilterChips
          value={platform}
          onChange={setPlatform}
          availablePlatforms={availablePlatforms}
          disabled={loading}
        />

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
      </div>

      <p className="text-xs text-muted-foreground">
        {INSIGHTS_PLATFORM_LABELS[platform]}-Insights
        {platform === "gwada"
          ? " — Reservierungen, Bewertungen, Nachrichten und News aus Gwada."
          : " — Kennzahlen dieser Plattform. Charts unter Statistiken."}{" "}
        <Link
          href={`${APP_ROUTES.insights.statistics}?platform=${platform}`}
          className="font-medium text-accent hover:underline"
        >
          Statistiken
        </Link>
      </p>

      {platform === "gwada" ? (
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
                  ? `Ø ${formatReviewRating(reviews.avgRating)} Sterne (alle Kanäle im Sync)`
                  : "Keine Bewertungen im Zeitraum"
              }
              icon={Star}
            />
            <KpiCard
              label="Eingehende Nachrichten"
              value={String(messages?.inbound ?? 0)}
              hint="WhatsApp, E-Mail, Social in Gwada"
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
      ) : null}

      {platform === "google_business" ? (
        <section aria-label="Google Business Insights" className="space-y-3">
          {!google?.connected ? (
            <ConnectHint
              label="Google Business"
              hint={googleCard?.hint ?? "Google unter Integrationen verbinden."}
            />
          ) : (
            <GoogleInsightsPanels google={google} />
          )}
        </section>
      ) : null}

      {platform === "facebook" ? (
        <section aria-label="Facebook Insights" className="space-y-3">
          {!facebook?.connected ? (
            <ConnectHint
              label="Facebook"
              hint={fbCard?.hint ?? "Facebook unter Integrationen verbinden."}
            />
          ) : (
            <FacebookInsightsPanels facebook={facebook} />
          )}
        </section>
      ) : null}

      {platform === "instagram" ? (
        <section aria-label="Instagram Insights" className="space-y-3">
          {!instagram?.connected ? (
            <ConnectHint
              label="Instagram"
              hint={igCard?.hint ?? "Instagram unter Integrationen verbinden."}
            />
          ) : (
            <InstagramInsightsPanels instagram={instagram} />
          )}
        </section>
      ) : null}

      {platform === "tripadvisor" ? (
        <PlatformMetricsPanel
          connected={Boolean(tripCard?.connected)}
          label="TripAdvisor"
          hint={tripCard?.hint}
          metrics={tripCard?.metrics ?? []}
          emptyIcon={Star}
        />
      ) : null}
    </div>
  );
}

function ConnectHint({ label, hint }: { label: string; hint: string }) {
  return (
    <Card className="border-border/50 shadow-card">
      <CardContent className="space-y-2 p-4 text-sm">
        <p className="font-medium">{label} nicht verbunden</p>
        <p className="text-muted-foreground">{hint}</p>
        <Link
          href={APP_ROUTES.settings.integrations}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          <Link2 className="size-3.5" aria-hidden />
          Integrationen öffnen
        </Link>
      </CardContent>
    </Card>
  );
}

function PlatformMetricsPanel({
  connected,
  label,
  hint,
  metrics,
  emptyIcon: EmptyIcon,
}: {
  connected: boolean;
  label: string;
  hint?: string;
  metrics: { label: string; value: string }[];
  emptyIcon: typeof Eye;
}) {
  if (!connected) {
    return <ConnectHint label={label} hint={hint ?? "Unter Integrationen verbinden."} />;
  }

  if (metrics.length === 0) {
    return (
      <Card className="border-border/50 shadow-card">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <EmptyIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium text-foreground">{label}</p>
            <p className="mt-1">{hint ?? "Noch keine Kennzahlen im Zeitraum."}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <section aria-label={`${label}-Kennzahlen`} className="space-y-3">
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <KpiCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            icon={EmptyIcon}
          />
        ))}
      </div>
    </section>
  );
}
