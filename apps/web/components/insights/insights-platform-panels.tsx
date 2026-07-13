"use client";

import {
  Eye,
  Globe,
  Heart,
  MapPinned,
  MessageCircle,
  MousePointerClick,
  Navigation,
  Phone,
  Search,
  Share2,
  Star,
  UserMinus,
  UserPlus,
  Users,
  Utensils,
  Video,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  formatInsightCount,
  type FacebookPagePlatformInsights,
  type GoogleBusinessPlatformInsights,
  type InstagramAccountPlatformInsights,
} from "@/lib/insights/platform-insights-types";

export function GoogleInsightsPanels({
  google,
}: {
  google: GoogleBusinessPlatformInsights;
}) {
  return (
    <div className="space-y-4">
      {google.error ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">{google.error}</p>
      ) : null}

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
          hint="Anrufe, Website, Routen, Chat, Buchungen, Menü, Bestellungen"
        />
        <KpiCard
          icon={Search}
          label="Suchaufrufe"
          value={formatInsightCount(google.searchImpressions)}
          hint={`${formatInsightCount(google.searchDesktop)} Desktop · ${formatInsightCount(google.searchMobile)} Mobile`}
        />
        <KpiCard
          icon={MapPinned}
          label="Maps-Aufrufe"
          value={formatInsightCount(google.mapsImpressions)}
          hint={`${formatInsightCount(google.mapsDesktop)} Desktop · ${formatInsightCount(google.mapsMobile)} Mobile`}
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
          label="Nachrichten"
          value={formatInsightCount(google.conversations)}
          hint="Chat-Gespräche über Google"
        />
        <KpiCard
          icon={Star}
          label="Buchungen"
          value={formatInsightCount(google.bookings)}
          hint="Reserve with Google"
        />
        <KpiCard
          icon={Utensils}
          label="Menü-Klicks"
          value={formatInsightCount(google.menuClicks)}
          hint="Speisekarten-Interaktionen"
        />
        <KpiCard
          icon={Utensils}
          label="Essensbestellungen"
          value={formatInsightCount(google.foodOrders)}
          hint="Bestellungen über das Profil"
        />
      </div>

      {google.searchKeywords.length > 0 ? (
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top-Suchbegriffe</CardTitle>
            <p className="text-xs text-muted-foreground">
              Wonach Nutzer in Google gesucht haben (monatlich aggregiert).
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y divide-border/40">
              {google.searchKeywords.slice(0, 15).map((row) => (
                <li
                  key={row.keyword}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">{row.keyword}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {row.impressions != null
                      ? formatInsightCount(row.impressions)
                      : row.threshold != null
                        ? `< ${formatInsightCount(row.threshold)}`
                        : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : !google.error ? (
        <p className="text-xs text-muted-foreground">
          Keine Suchbegriffe im Zeitraum (oder noch nachziehend).
        </p>
      ) : null}
    </div>
  );
}

export function FacebookInsightsPanels({
  facebook,
}: {
  facebook: FacebookPagePlatformInsights;
}) {
  return (
    <div className="space-y-4">
      {facebook.error ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {facebook.error === "facebook_insights_app_review"
            ? "Meta muss „Seiten-Statistiken“ (read_insights) freigeben (App Review)."
            : facebook.error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Reichweite"
          value={formatInsightCount(facebook.reach)}
          hint="Einzigartige Media-Viewer"
        />
        <KpiCard
          icon={Eye}
          label="Media-Views"
          value={formatInsightCount(facebook.impressions)}
          hint="Beiträge, Stories, Videos, Ads"
        />
        <KpiCard
          icon={MousePointerClick}
          label="Beitrags-Interaktionen"
          value={formatInsightCount(facebook.postEngagements)}
          hint="Reaktionen, Kommentare, Shares"
        />
        <KpiCard
          icon={Eye}
          label="Seitenaufrufe"
          value={formatInsightCount(facebook.pageViews)}
          hint="Aufrufe der Facebook-Seite"
        />
        <KpiCard
          icon={UserPlus}
          label="Neue Follower"
          value={formatInsightCount(facebook.followsUnique)}
          hint="Einzigartige Follows im Zeitraum"
        />
        <KpiCard
          icon={UserMinus}
          label="Entfolger"
          value={formatInsightCount(facebook.unfollowsUnique)}
          hint="Unfollows im Zeitraum"
        />
        <KpiCard
          icon={MousePointerClick}
          label="CTA / Kontakt"
          value={formatInsightCount(facebook.ctaClicks)}
          hint="Klicks auf Kontaktinfo & CTA"
        />
        <KpiCard
          icon={Video}
          label="Video-Views"
          value={formatInsightCount(facebook.videoViews)}
          hint="Videoaufrufe ≥ 3 Sekunden"
        />
        {facebook.fans != null ? (
          <KpiCard
            icon={Heart}
            label="Follower gesamt"
            value={formatInsightCount(facebook.fans)}
            hint="Aktueller Bestand"
          />
        ) : null}
      </div>
    </div>
  );
}

export function InstagramInsightsPanels({
  instagram,
}: {
  instagram: InstagramAccountPlatformInsights;
}) {
  return (
    <div className="space-y-4">
      {instagram.error ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {instagram.error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Reichweite"
          value={formatInsightCount(instagram.reach)}
          hint="Accounts erreicht"
        />
        <KpiCard
          icon={Eye}
          label="Views"
          value={formatInsightCount(instagram.views)}
          hint="Inhaltsaufrufe"
        />
        <KpiCard
          icon={MousePointerClick}
          label="Interaktionen"
          value={formatInsightCount(instagram.totalInteractions)}
          hint="Gesamtinteraktionen"
        />
        <KpiCard
          icon={Users}
          label="Accounts engaged"
          value={formatInsightCount(instagram.accountsEngaged)}
          hint="Interagierende Konten"
        />
        <KpiCard
          icon={Heart}
          label="Likes"
          value={formatInsightCount(instagram.likes)}
          hint="Beiträge, Reels, Videos"
        />
        <KpiCard
          icon={MessageCircle}
          label="Kommentare"
          value={formatInsightCount(instagram.comments)}
          hint="Kommentare auf Inhalte"
        />
        <KpiCard
          icon={Share2}
          label="Shares"
          value={formatInsightCount(instagram.shares)}
          hint="Geteilte Inhalte"
        />
        <KpiCard
          icon={Star}
          label="Saves"
          value={formatInsightCount(instagram.saves)}
          hint="Gespeicherte Inhalte"
        />
        <KpiCard
          icon={MessageCircle}
          label="Story-Antworten"
          value={formatInsightCount(instagram.replies)}
          hint="Antworten auf Stories"
        />
        <KpiCard
          icon={MousePointerClick}
          label="Profil-Link-Taps"
          value={formatInsightCount(instagram.profileLinkTaps)}
          hint="Adresse, Anrufen, E-Mail, Text"
        />
        <KpiCard
          icon={UserPlus}
          label="Follower +"
          value={formatInsightCount(instagram.follows)}
          hint="Neue Follower (ab ~100 Followern)"
        />
        <KpiCard
          icon={UserMinus}
          label="Entfolger"
          value={formatInsightCount(instagram.unfollows)}
          hint="Unfollows im Zeitraum"
        />
      </div>
    </div>
  );
}
