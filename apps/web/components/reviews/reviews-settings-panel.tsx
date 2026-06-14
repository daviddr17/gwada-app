"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ReviewPlatformIcon } from "@/components/reviews/review-platform-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import {
  REVIEW_PLATFORM_LABELS,
  REVIEW_PLATFORM_ORDER,
} from "@/lib/constants/review-platforms";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useReviewPlatformConnections } from "@/lib/hooks/use-review-platform-connections";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  defaultReviewAutoReplyRules,
  type ReviewAutoReplyRule,
} from "@/lib/reviews/review-settings-types";
import { cn } from "@/lib/utils";

const STAR_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  5: "5 Sterne",
  4: "4 Sterne",
  3: "3 Sterne",
  2: "2 Sterne",
  1: "1 Stern",
};

function ReviewsSettingsSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonCardFrame key={i} className="space-y-4 p-6 shadow-card">
          <Skeleton className="h-5 w-32 rounded-md" />
          {Array.from({ length: 3 }).map((__, j) => (
            <div key={j} className="space-y-2">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ))}
        </SkeletonCardFrame>
      ))}
    </div>
  );
}

export function ReviewsSettingsPanel() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { googleConnected, facebookConnected } =
    useReviewPlatformConnections(restaurantId);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<ReviewAutoReplyRule[]>(
    defaultReviewAutoReplyRules(),
  );
  const [initialRules, setInitialRules] = useState<ReviewAutoReplyRule[]>(
    defaultReviewAutoReplyRules(),
  );

  const dirty = useMemo(
    () => JSON.stringify(rules) !== JSON.stringify(initialRules),
    [rules, initialRules],
  );

  const loadSettings = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reviews/settings?${new URLSearchParams({ restaurantId })}`,
      );
      const json = (await res.json()) as {
        rules?: ReviewAutoReplyRule[];
        error?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? "Einstellungen konnten nicht geladen werden.");
        return;
      }
      const next = json.rules ?? defaultReviewAutoReplyRules();
      setRules(next);
      setInitialRules(next);
    } catch {
      toast.error("Netzwerkfehler beim Laden der Einstellungen.");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateRule = (
    platform: ReviewAutoReplyRule["platform"],
    rating: ReviewAutoReplyRule["rating"],
    patch: Partial<Pick<ReviewAutoReplyRule, "enabled" | "replyTemplate">>,
  ) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.platform === platform && rule.rating === rating
          ? { ...rule, ...patch }
          : rule,
      ),
    );
  };

  const save = async () => {
    if (!restaurantId || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/reviews/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, rules }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setInitialRules(rules);
      toast.success("Einstellungen gespeichert.");
    } catch {
      toast.error("Netzwerkfehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  };

  const platformHint = (platform: ReviewAutoReplyRule["platform"]) => {
    if (platform === "google" && !googleConnected) {
      return "Google Business ist nicht verbunden — automatische Antworten werden erst nach Verknüpfung gesendet.";
    }
    if (platform === "facebook" && !facebookConnected) {
      return "Facebook ist nicht verbunden — automatische Antworten werden erst nach Verknüpfung gesendet.";
    }
    if (platform === "gwada") {
      return "Gwada-Bewertungen haben keine externe Antwort-Funktion — Regeln werden vorbereitet, aber noch nicht automatisch versendet.";
    }
    return "Bei neuen Bewertungen ohne bestehende Antwort wird die Vorlage automatisch veröffentlicht.";
  };

  if (!ready) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 pt-2">
      <p className="text-sm text-muted-foreground">
        Pro Plattform und Sternebewertung kannst du eine Antwort-Vorlage hinterlegen.
        Platzhalter:{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">{"{authorName}"}</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">{"{rating}"}</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">{"{restaurantName}"}</code>.
      </p>

      {showSkeleton ? (
        <ReviewsSettingsSkeleton />
      ) : (
        <div className="space-y-4">
          {REVIEW_PLATFORM_ORDER.map((platform) => {
            const platformRules = rules.filter((rule) => rule.platform === platform);
            return (
              <Card key={platform} className="border-border/50 shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ReviewPlatformIcon platform={platform} className="size-4" />
                    {REVIEW_PLATFORM_LABELS[platform]}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{platformHint(platform)}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {platformRules.map((rule) => (
                    <div
                      key={`${rule.platform}-${rule.rating}`}
                      className="space-y-3 rounded-xl border border-border/50 bg-muted/15 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <Label
                          htmlFor={`auto-reply-${rule.platform}-${rule.rating}`}
                          className="text-sm font-medium"
                        >
                          {STAR_LABELS[rule.rating]}
                        </Label>
                        <Switch
                          id={`auto-reply-${rule.platform}-${rule.rating}`}
                          checked={rule.enabled}
                          onCheckedChange={(enabled) =>
                            updateRule(rule.platform, rule.rating, { enabled })
                          }
                        />
                      </div>
                      <Textarea
                        value={rule.replyTemplate}
                        onChange={(e) =>
                          updateRule(rule.platform, rule.rating, {
                            replyTemplate: e.target.value,
                          })
                        }
                        rows={3}
                        placeholder="Danke für deine Bewertung, {authorName} …"
                        disabled={!rule.enabled}
                        className={cn(!rule.enabled && "opacity-60")}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <SettingsStickySaveBar show={dirty}>
        <Button
          type="button"
          disabled={saving || loading}
          className={cn(
            "h-11 w-full min-w-[12rem] sm:w-auto",
            settingsAccentSaveButtonClassName,
          )}
          onClick={() => void save()}
        >
          {saving ? "Speichern …" : "Speichern"}
        </Button>
      </SettingsStickySaveBar>
    </div>
  );
}
