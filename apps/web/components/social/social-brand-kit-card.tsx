"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { SocialAutopilotLookDrawer } from "@/components/social/social-autopilot-look-drawer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import type { NewsPlatform } from "@/lib/constants/news-platforms";
import {
  SOCIAL_PHOTO_LOOK_LABELS,
  SOCIAL_TONES,
  SOCIAL_TONE_LABELS,
  defaultSocialBrandKit,
  type SocialBrandKit,
  type SocialTone,
} from "@/lib/social/social-brand-kit";
import { allSocialPublishPlatformOptions } from "@/lib/social/social-publish-platforms";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

function kitEqual(a: SocialBrandKit, b: SocialBrandKit): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Autopilot-Einstellungen: nur Felder, die Idee/Generate wirklich nutzen.
 * Aussehen (Palette/Look/Layouts) → Bottom Sheet.
 * Ungenutzt ausgeblendet: Bildstrategie, Nie-KI-Speisen, Hero-Fotos.
 */
export function SocialBrandKitCard({
  restaurantId,
}: {
  restaurantId: string | null;
}) {
  const [kit, setKit] = useState<SocialBrandKit | null>(null);
  const [saved, setSaved] = useState<SocialBrandKit | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lookOpen, setLookOpen] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading);

  useEffect(() => {
    if (!restaurantId) {
      setKit(null);
      setSaved(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(
      `/api/social/brand-kit?restaurantId=${encodeURIComponent(restaurantId)}`,
    )
      .then(async (kitRes) => {
        const data = (await kitRes.json().catch(() => ({}))) as {
          kit?: SocialBrandKit;
        };
        if (cancelled) return;
        const next = data.kit ?? defaultSocialBrandKit(restaurantId);
        setKit(next);
        setSaved(next);
      })
      .catch(() => {
        if (!cancelled) {
          const next = defaultSocialBrandKit(restaurantId);
          setKit(next);
          setSaved(next);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const dirty = useMemo(() => {
    if (!kit || !saved) return false;
    return !kitEqual(kit, saved);
  }, [kit, saved]);

  const save = async () => {
    if (!restaurantId || !kit) return;
    setSaving(true);
    try {
      const res = await fetch("/api/social/brand-kit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, kit }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        kit?: SocialBrandKit;
        error?: string;
      };
      if (!res.ok) {
        toast.error("Einstellungen konnten nicht gespeichert werden");
        return;
      }
      const next = data.kit ?? kit;
      setKit(next);
      setSaved(next);
      toast.success("Gespeichert — nächster KI-Post nutzt das");
    } finally {
      setSaving(false);
    }
  };

  if (!restaurantId) return null;

  if (showSkeleton || !kit) {
    return (
      <SkeletonCardFrame
        className="min-h-64"
        aria-busy
        aria-label="Einstellungen werden geladen"
      >
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-4 h-24 w-full" />
      </SkeletonCardFrame>
    );
  }

  const lookSummary = `${SOCIAL_PHOTO_LOOK_LABELS[kit.photoLook]} · ${kit.preferredLayouts.length} Layouts`;

  return (
    <>
      <Card className="border-border/50 shadow-card">
        <CardHeader className="gap-2">
          <CardTitle className="text-xl">Einstellungen</CardTitle>
          <CardDescription>
            Stil und Kanäle für KI-Posts. Erstellen läuft unter News → Neue News
            → KI-Post.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* 1. Autopilot */}
          <section className="space-y-3">
            <p className="text-sm font-medium">Autopilot</p>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Aktiv</p>
                <p className="text-xs text-muted-foreground">
                  Vorschläge dürfen erzeugt werden
                </p>
              </div>
              <Switch
                checked={kit.enabled}
                onCheckedChange={(enabled) =>
                  setKit((k) =>
                    k ? { ...k, enabled: enabled === true } : k,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="social-weekly">Posts pro Woche (Ziel)</Label>
              <Input
                id="social-weekly"
                type="number"
                min={1}
                max={7}
                value={kit.weeklyPostTarget}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  setKit((k) =>
                    k
                      ? {
                          ...k,
                          weeklyPostTarget: Number.isFinite(n)
                            ? Math.min(7, Math.max(1, n))
                            : 3,
                        }
                      : k,
                  );
                }}
                className="h-11 rounded-xl"
              />
            </div>
          </section>

          {/* 2. Schreibstil */}
          <section className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Schreibstil</p>
              <p className="text-xs text-muted-foreground">
                Ton und Stimme für Texte — auch „Aus Social lernen“ oben.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Ton</Label>
              <Select
                value={kit.tone}
                onValueChange={(v) => {
                  if (typeof v !== "string") return;
                  if (!SOCIAL_TONES.includes(v as SocialTone)) return;
                  setKit((k) => (k ? { ...k, tone: v as SocialTone } : k));
                }}
              >
                <SelectTrigger
                  className={appSelectTriggerAccentCn(
                    "h-11 w-full rounded-xl",
                  )}
                >
                  <SelectValue>{SOCIAL_TONE_LABELS[kit.tone]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_TONES.map((key) => (
                    <SelectItem key={key} value={key}>
                      {SOCIAL_TONE_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="social-voice">So klingen wir</Label>
              <Textarea
                id="social-voice"
                value={kit.voiceNotes}
                onChange={(e) =>
                  setKit((k) =>
                    k ? { ...k, voiceNotes: e.target.value } : k,
                  )
                }
                className="min-h-20 rounded-xl"
                placeholder="z. B. familiär, keine Anglizismen, duzen, kurz"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="social-gold">Beispiel-Texte</Label>
              <Textarea
                id="social-gold"
                value={kit.goldCaptions.join("\n")}
                onChange={(e) =>
                  setKit((k) =>
                    k
                      ? {
                          ...k,
                          goldCaptions: e.target.value
                            .split("\n")
                            .map((line) => line.trim())
                            .filter(Boolean)
                            .slice(0, 10),
                        }
                      : k,
                  )
                }
                className="min-h-24 rounded-xl"
                placeholder={"Eine starke Zeile pro Zeile"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="social-cta">Standard-Aufruf</Label>
              <Input
                id="social-cta"
                value={kit.cta}
                onChange={(e) =>
                  setKit((k) => (k ? { ...k, cta: e.target.value } : k))
                }
                className="h-11 rounded-xl"
                placeholder="Tisch reservieren"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="social-hashtags">Hashtags</Label>
              <Input
                id="social-hashtags"
                value={kit.hashtags.join(" ")}
                onChange={(e) =>
                  setKit((k) =>
                    k
                      ? {
                          ...k,
                          hashtags: e.target.value
                            .split(/\s+/)
                            .map((h) => h.trim())
                            .filter(Boolean)
                            .slice(0, 12),
                        }
                      : k,
                  )
                }
                className="h-11 rounded-xl"
                placeholder="#berlin #restaurant"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="social-donot">Bitte nicht</Label>
              <Textarea
                id="social-donot"
                value={kit.doNot}
                onChange={(e) =>
                  setKit((k) => (k ? { ...k, doNot: e.target.value } : k))
                }
                className="min-h-20 rounded-xl"
                placeholder="z. B. kein Discount-Ton"
              />
            </div>
          </section>

          {/* 3. Aussehen → Sheet */}
          <section className="space-y-2">
            <p className="text-sm font-medium">Aussehen</p>
            <button
              type="button"
              onClick={() => setLookOpen(true)}
              className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3.5 text-left text-sm touch-manipulation transition-colors hover:border-border"
            >
              <span className="min-w-0 truncate text-muted-foreground">
                {lookSummary}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </section>

          {/* 4. Kanäle */}
          <section className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">Kanäle</p>
              <p className="text-xs text-muted-foreground">
                Standard beim Freigeben — nur verbundene zählen.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {allSocialPublishPlatformOptions().map((opt) => {
                const checked = kit.publishPlatforms.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const on = v === true;
                        setKit((k) => {
                          if (!k) return k;
                          const next = new Set(k.publishPlatforms);
                          if (on) next.add(opt.value);
                          else next.delete(opt.value);
                          const list = [...next] as NewsPlatform[];
                          return {
                            ...k,
                            publishPlatforms: list.length
                              ? list
                              : (["gwada"] as NewsPlatform[]),
                          };
                        });
                      }}
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Auch als Story</p>
                <p className="text-xs text-muted-foreground">
                  Instagram- und Facebook-Story (wenn verbunden)
                </p>
              </div>
              <Switch
                checked={kit.publishStories}
                onCheckedChange={(v) =>
                  setKit((k) =>
                    k ? { ...k, publishStories: v === true } : k,
                  )
                }
              />
            </div>
          </section>

          <Button
            type="button"
            disabled={!dirty || saving}
            className={cn("h-11 w-full", settingsAccentSaveButtonClassName)}
            onClick={() => void save()}
          >
            {saving ? "Speichern…" : "Speichern"}
          </Button>
        </CardContent>
      </Card>

      <SocialAutopilotLookDrawer
        open={lookOpen}
        onOpenChange={setLookOpen}
        kit={kit}
        onChange={setKit}
      />
    </>
  );
}
