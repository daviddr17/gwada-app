"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { SocialTemplatePreview } from "@/components/social/social-template-preview";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useAccentColor } from "@/lib/contexts/accent-color-context";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import {
  SOCIAL_SLOT_KIND_LABELS,
  SOCIAL_TEMPLATE_LABELS,
  type SocialMediaTask,
  type SocialPostSuggestion,
} from "@/lib/social/social-suggestion-types";
import type { SocialStylePreset } from "@/lib/social/social-brand-kit";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { cn } from "@/lib/utils";

function formatPlan(iso: string): string {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function SocialAutopilotScreen() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const { profile } = useRestaurantProfile();
  const { accentHex } = useAccentColor();
  const [suggestions, setSuggestions] = useState<SocialPostSuggestion[]>([]);
  const [tasks, setTasks] = useState<SocialMediaTask[]>([]);
  const [stylePreset, setStylePreset] =
    useState<SocialStylePreset>("warm_gastro");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draftCaptions, setDraftCaptions] = useState<Record<string, string>>(
    {},
  );
  const showSkeleton = useDeferredSkeleton(loading);

  const load = useCallback(
    async (opts?: { refresh?: boolean }) => {
      if (!restaurantId) return;
      setLoading(true);
      try {
        const qs = new URLSearchParams({ restaurantId });
        if (opts?.refresh) qs.set("refresh", "1");
        const [sugRes, kitRes] = await Promise.all([
          fetch(`/api/social/suggestions?${qs}`),
          fetch(`/api/social/brand-kit?restaurantId=${encodeURIComponent(restaurantId)}`),
        ]);
        const sugData = (await sugRes.json().catch(() => ({}))) as {
          suggestions?: SocialPostSuggestion[];
          tasks?: SocialMediaTask[];
          error?: string;
        };
        const kitData = (await kitRes.json().catch(() => ({}))) as {
          kit?: { stylePreset?: SocialStylePreset };
        };
        if (!sugRes.ok) {
          toast.error("Vorschläge konnten nicht geladen werden");
          return;
        }
        const list = sugData.suggestions ?? [];
        setSuggestions(list.filter((s) => s.status === "pending" || s.status === "needs_asset"));
        setTasks(sugData.tasks ?? []);
        if (kitData.kit?.stylePreset) setStylePreset(kitData.kit.stylePreset);
        setDraftCaptions((prev) => {
          const next = { ...prev };
          for (const s of list) {
            if (next[s.id] == null) next[s.id] = s.caption;
          }
          return next;
        });
      } finally {
        setLoading(false);
      }
    },
    [restaurantId],
  );

  useEffect(() => {
    if (!ready || !restaurantId) return;
    void load();
  }, [ready, restaurantId, load]);

  const approve = async (id: string, publishNow: boolean) => {
    if (!restaurantId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/social/suggestions/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          caption: draftCaptions[id],
          publishNow,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        published?: boolean;
      };
      if (!res.ok) {
        toast.error(
          data.error === "image_required"
            ? "Für die Freigabe fehlt noch ein Bild"
            : "Freigabe fehlgeschlagen",
        );
        return;
      }
      toast.success(
        data.published
          ? "Post freigegeben und veröffentlicht"
          : "Post freigegeben (geplant)",
      );
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  const skip = async (id: string) => {
    if (!restaurantId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/social/suggestions/${id}/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      if (!res.ok) {
        toast.error("Überspringen fehlgeschlagen");
        return;
      }
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  const completeTask = async (id: string, status: "done" | "dismissed") => {
    if (!restaurantId) return;
    const res = await fetch(`/api/social/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, status }),
    });
    if (!res.ok) {
      toast.error("Aufgabe konnte nicht aktualisiert werden");
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  if (!ready) return <WorkspaceRestaurantResolvePlaceholder />;
  if (!restaurantId) return <WorkspaceRestaurantMissingMessage />;

  const restaurantName = profile?.name?.trim() || "Restaurant";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Fertige Vorschläge für diese Woche — freigeben, anpassen oder
          überspringen.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => void load({ refresh: true })}
            disabled={loading}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Neu vorschlagen
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            render={<Link href={APP_ROUTES.settings.restaurant} />}
          >
            Social-Marke
          </Button>
        </div>
      </div>

      {tasks.length > 0 ? (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Card key={task.id} className="border-border/50 shadow-card">
              <CardHeader className="gap-1.5 pb-2">
                <CardTitle className="text-base">Aufgabe: {task.title}</CardTitle>
                <CardDescription className="whitespace-pre-line">
                  {task.body}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className={brandActionButtonRoundedClassName}
                  render={<Link href={APP_ROUTES.galerie.overview} />}
                >
                  Zur Galerie
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void completeTask(task.id, "done")}
                >
                  Erledigt
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void completeTask(task.id, "dismissed")}
                >
                  Später
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {showSkeleton ? (
        <div className="space-y-4" aria-busy>
          {[0, 1].map((i) => (
            <SkeletonCardFrame key={i} className="space-y-3">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="h-20 w-full" />
            </SkeletonCardFrame>
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <Card className="border-border/50 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Keine offenen Vorschläge</CardTitle>
            <CardDescription>
              Speichert eure Social-Marke und tippt „Neu vorschlagen“, oder
              wartet auf den nächsten Wochenlauf. Mit mehr Fotos in Galerie und
              Speisekarte werden die Vorschläge besser.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-6">
          {suggestions.map((s) => (
            <Card key={s.id} className="border-border/50 shadow-card overflow-hidden">
              <CardHeader className="gap-1 pb-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border/60 px-2 py-0.5">
                    {SOCIAL_SLOT_KIND_LABELS[s.slotKind]}
                  </span>
                  <span className="rounded-full border border-border/60 px-2 py-0.5">
                    {SOCIAL_TEMPLATE_LABELS[s.templateId]}
                  </span>
                  <span>{formatPlan(s.plannedAt)}</span>
                  {s.status === "needs_asset" ? (
                    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-800 dark:text-amber-200">
                      Bild fehlt
                    </span>
                  ) : null}
                </div>
                <CardTitle className="text-lg">
                  {s.title?.trim() || "Vorschlag"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SocialTemplatePreview
                  templateId={s.templateId}
                  stylePreset={stylePreset}
                  accentHex={accentHex}
                  restaurantName={restaurantName}
                  title={s.title}
                  caption={draftCaptions[s.id] ?? s.caption}
                  imageUrl={s.asset.imageUrl}
                />
                <Textarea
                  value={draftCaptions[s.id] ?? s.caption}
                  onChange={(e) =>
                    setDraftCaptions((prev) => ({
                      ...prev,
                      [s.id]: e.target.value,
                    }))
                  }
                  className="min-h-28 rounded-xl"
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className={cn("flex-1", brandActionButtonRoundedClassName)}
                    disabled={busyId === s.id || s.status === "needs_asset"}
                    onClick={() => void approve(s.id, true)}
                  >
                    <Check className="size-4" />
                    Freigeben & posten
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-xl"
                    disabled={busyId === s.id}
                    onClick={() => void approve(s.id, false)}
                  >
                    Freigeben (planen)
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-xl"
                    disabled={busyId === s.id}
                    onClick={() => void skip(s.id)}
                  >
                    <SkipForward className="size-4" />
                    Überspringen
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
