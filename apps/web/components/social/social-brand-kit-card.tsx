"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  SOCIAL_IMAGE_STRATEGIES,
  SOCIAL_IMAGE_STRATEGY_LABELS,
  SOCIAL_STYLE_PRESETS,
  SOCIAL_STYLE_PRESET_LABELS,
  SOCIAL_TONES,
  SOCIAL_TONE_LABELS,
  defaultSocialBrandKit,
  type SocialBrandKit,
  type SocialImageStrategy,
  type SocialStylePreset,
  type SocialTone,
} from "@/lib/social/social-brand-kit";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

function kitEqual(a: SocialBrandKit, b: SocialBrandKit): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function SocialBrandKitCard({
  restaurantId,
}: {
  restaurantId: string | null;
}) {
  const [kit, setKit] = useState<SocialBrandKit | null>(null);
  const [saved, setSaved] = useState<SocialBrandKit | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading);

  useEffect(() => {
    if (!restaurantId) {
      setKit(null);
      setSaved(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/social/brand-kit?restaurantId=${encodeURIComponent(restaurantId)}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
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
        toast.error("Social-Marke konnte nicht gespeichert werden");
        return;
      }
      const next = data.kit ?? kit;
      setKit(next);
      setSaved(next);
      toast.success("Social-Marke gespeichert");
    } finally {
      setSaving(false);
    }
  };

  if (!restaurantId) return null;

  if (showSkeleton || !kit) {
    return (
      <SkeletonCardFrame className="min-h-64" aria-busy aria-label="Social-Marke wird geladen">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-4 h-24 w-full" />
      </SkeletonCardFrame>
    );
  }

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="gap-2">
        <CardTitle className="text-xl">Social-Marke</CardTitle>
        <CardDescription>
          Tonalität, Bildstrategie und Vorlagen für den Social-Autopilot. Posts
          werden vorgeschlagen — Freigabe bleibt bei euch.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">Autopilot aktiv</p>
            <p className="text-xs text-muted-foreground">
              Vorschläge für diese Woche erzeugen
            </p>
          </div>
          <Switch
            checked={kit.enabled}
            onCheckedChange={(enabled) =>
              setKit((k) => (k ? { ...k, enabled: enabled === true } : k))
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Bildstrategie</Label>
          <Select
            value={kit.imageStrategy}
            onValueChange={(v) => {
              if (typeof v !== "string") return;
              if (!SOCIAL_IMAGE_STRATEGIES.includes(v as SocialImageStrategy)) return;
              setKit((k) =>
                k ? { ...k, imageStrategy: v as SocialImageStrategy } : k,
              );
            }}
          >
            <SelectTrigger className={appSelectTriggerAccentCn("h-11 w-full rounded-xl")}>
              <SelectValue>
                {SOCIAL_IMAGE_STRATEGY_LABELS[kit.imageStrategy]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SOCIAL_IMAGE_STRATEGIES.map((key) => (
                <SelectItem key={key} value={key}>
                  {SOCIAL_IMAGE_STRATEGY_LABELS[key]}
                  {key === "ai_strong" ? " — KI-Bilder folgen später" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">Nie KI für Speisen</p>
            <p className="text-xs text-muted-foreground">
              Gerichte nur mit echten Fotos (empfohlen)
            </p>
          </div>
          <Switch
            checked={kit.neverAiFood}
            onCheckedChange={(neverAiFood) =>
              setKit((k) => (k ? { ...k, neverAiFood } : k))
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tonalität</Label>
            <Select
              value={kit.tone}
              onValueChange={(v) => {
                if (typeof v !== "string") return;
                if (!SOCIAL_TONES.includes(v as SocialTone)) return;
                setKit((k) => (k ? { ...k, tone: v as SocialTone } : k));
              }}
            >
              <SelectTrigger className={appSelectTriggerAccentCn("h-11 w-full rounded-xl")}>
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
            <Label>Stil-Preset</Label>
            <Select
              value={kit.stylePreset}
              onValueChange={(v) => {
                if (typeof v !== "string") return;
                if (!SOCIAL_STYLE_PRESETS.includes(v as SocialStylePreset)) return;
                setKit((k) =>
                  k ? { ...k, stylePreset: v as SocialStylePreset } : k,
                );
              }}
            >
              <SelectTrigger className={appSelectTriggerAccentCn("h-11 w-full rounded-xl")}>
                <SelectValue>
                  {SOCIAL_STYLE_PRESET_LABELS[kit.stylePreset]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SOCIAL_STYLE_PRESETS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {SOCIAL_STYLE_PRESET_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="social-cta">Standard-CTA</Label>
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
          <Label htmlFor="social-hashtags">Hashtags (Leerzeichen getrennt)</Label>
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
          <Label htmlFor="social-voice">So klingen wir</Label>
          <Textarea
            id="social-voice"
            value={kit.voiceNotes}
            onChange={(e) =>
              setKit((k) => (k ? { ...k, voiceNotes: e.target.value } : k))
            }
            className="min-h-20 rounded-xl"
            placeholder="z. B. familiär, keine Anglizismen, duzen"
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
            placeholder="z. B. keine Überraschungsmenüs bewerben, kein Discount-Ton"
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

        <Button
          type="button"
          disabled={!dirty || saving}
          className={cn("h-11 w-full", settingsAccentSaveButtonClassName)}
          onClick={() => void save()}
        >
          {saving ? "Speichern…" : "Social-Marke speichern"}
        </Button>
      </CardContent>
    </Card>
  );
}
