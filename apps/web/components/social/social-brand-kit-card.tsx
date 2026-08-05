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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import type { NewsPlatform } from "@/lib/constants/news-platforms";
import { MENU_TAXONOMY_COLOR_INPUT_CLASSNAME } from "@/lib/constants/menu-color-picker";
import {
  SOCIAL_FEED_LAYOUT_HINTS,
  SOCIAL_FEED_LAYOUT_IDS,
  SOCIAL_FEED_LAYOUT_LABELS,
  SOCIAL_IMAGE_STRATEGIES,
  SOCIAL_IMAGE_STRATEGY_LABELS,
  SOCIAL_PHOTO_LOOK_HINTS,
  SOCIAL_PHOTO_LOOK_LABELS,
  SOCIAL_PHOTO_LOOKS,
  SOCIAL_TONES,
  SOCIAL_TONE_LABELS,
  defaultSocialBrandKit,
  togglePreferredFeedLayout,
  type SocialBrandKit,
  type SocialFeedLayoutId,
  type SocialFeedPalette,
  type SocialHeroAsset,
  type SocialImageStrategy,
  type SocialPhotoLook,
  type SocialTone,
} from "@/lib/social/social-brand-kit";
import { allSocialPublishPlatformOptions } from "@/lib/social/social-publish-platforms";
import { normalizeHex } from "@/lib/theme/color-utils";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

function kitEqual(a: SocialBrandKit, b: SocialBrandKit): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function FeedColorRow({
  id,
  label,
  hint,
  value,
  allowEmpty,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  allowEmpty?: boolean;
  onChange: (hex: string) => void;
}) {
  const pickerValue = normalizeHex(value) ?? "#c4a574";
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      <div className="flex items-center gap-2">
        <input
          id={`${id}-picker`}
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          className={MENU_TAXONOMY_COLOR_INPUT_CLASSNAME}
          aria-label={`${label} wählen`}
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={allowEmpty ? "optional" : "#c4a574"}
          className="h-11 flex-1 rounded-xl font-mono text-sm"
          spellCheck={false}
          maxLength={7}
        />
        {allowEmpty && value.trim() ? (
          <Button
            type="button"
            variant="ghost"
            className="h-11 shrink-0 rounded-xl px-3 text-xs text-muted-foreground"
            onClick={() => onChange("")}
          >
            Weg
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function patchPalette(
  kit: SocialBrandKit,
  patch: Partial<SocialFeedPalette>,
): SocialBrandKit {
  return {
    ...kit,
    feedPalette: { ...kit.feedPalette, ...patch },
  };
}

type HeroOption = {
  id: string;
  group: "gallery" | "menu" | "profile";
  label: string;
  imageUrl: string | null;
  source: SocialHeroAsset["source"];
  sourceId: string;
};

export function SocialBrandKitCard({
  restaurantId,
}: {
  restaurantId: string | null;
}) {
  const [kit, setKit] = useState<SocialBrandKit | null>(null);
  const [saved, setSaved] = useState<SocialBrandKit | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [heroOptions, setHeroOptions] = useState<HeroOption[]>([]);
  const showSkeleton = useDeferredSkeleton(loading);

  useEffect(() => {
    if (!restaurantId) {
      setKit(null);
      setSaved(null);
      setHeroOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(
        `/api/social/brand-kit?restaurantId=${encodeURIComponent(restaurantId)}`,
      ),
      fetch(
        `/api/social/asset-options?restaurantId=${encodeURIComponent(restaurantId)}`,
      ),
    ])
      .then(async ([kitRes, optRes]) => {
        const data = (await kitRes.json().catch(() => ({}))) as {
          kit?: SocialBrandKit;
        };
        const optData = (await optRes.json().catch(() => ({}))) as {
          options?: Array<{
            id: string;
            group: string;
            label: string;
            imageUrl: string | null;
            source?: string;
            sourceId?: string;
          }>;
        };
        if (cancelled) return;
        const next = data.kit ?? defaultSocialBrandKit(restaurantId);
        setKit(next);
        setSaved(next);
        const eligible = (optData.options ?? []).filter(
          (o) =>
            (o.group === "gallery" ||
              o.group === "menu" ||
              o.group === "profile") &&
            o.imageUrl &&
            (o.source === "gallery" ||
              o.source === "menu" ||
              o.source === "profile") &&
            typeof o.sourceId === "string",
        );
        // Ausgewogen: Galerie soll Speisekarte nicht komplett verdrängen
        const byGroup = {
          gallery: eligible.filter((o) => o.group === "gallery").slice(0, 12),
          menu: eligible.filter((o) => o.group === "menu").slice(0, 10),
          profile: eligible.filter((o) => o.group === "profile").slice(0, 2),
        };
        const heroes = [...byGroup.gallery, ...byGroup.menu, ...byGroup.profile]
          .slice(0, 24)
          .map((o) => ({
            id: o.id,
            group: o.group as HeroOption["group"],
            label: o.label,
            imageUrl: o.imageUrl,
            source: o.source as SocialHeroAsset["source"],
            sourceId: o.sourceId as string,
          }));
        setHeroOptions(heroes);
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
      toast.success(
        "Social-Marke gespeichert — „Neu vorschlagen“ im Autopilot übernimmt sie",
      );
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

  const palette = kit.feedPalette;

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="gap-2">
        <CardTitle className="text-xl">Social-Marke</CardTitle>
        <CardDescription>
          Palette, Foto-Look und Layouts für den Autopilot. Nach dem Speichern
          „Neu vorschlagen“ tippen — Freigabe bleibt bei euch.
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

        <div className="space-y-3 rounded-xl border border-border/50 p-3">
          <div>
            <p className="text-sm font-medium">Feed-Palette</p>
            <p className="text-xs text-muted-foreground">
              Farben für alle Posts — sorgt für ein stimmiges Gesamtbild.
            </p>
          </div>
          <div
            className="flex h-10 overflow-hidden rounded-xl border border-border/40"
            aria-hidden
          >
            <span className="flex-1" style={{ backgroundColor: palette.surfaceDark }} />
            <span className="flex-1" style={{ backgroundColor: palette.accent }} />
            <span
              className="flex-1"
              style={{
                backgroundColor: palette.secondary ?? palette.surfaceLight,
              }}
            />
            <span className="flex-1" style={{ backgroundColor: palette.surfaceLight }} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FeedColorRow
              id="feed-accent"
              label="Akzent"
              hint="Hairlines, dezente Highlights"
              value={palette.accent}
              onChange={(hex) =>
                setKit((k) => (k ? patchPalette(k, { accent: hex }) : k))
              }
            />
            <FeedColorRow
              id="feed-secondary"
              label="Zweitfarbe"
              hint="Optional — z. B. für Flächen"
              value={palette.secondary ?? ""}
              allowEmpty
              onChange={(hex) =>
                setKit((k) =>
                  k
                    ? patchPalette(k, {
                        secondary: hex.trim() ? hex : null,
                      })
                    : k,
                )
              }
            />
            <FeedColorRow
              id="feed-dark"
              label="Dunkle Fläche"
              hint="Panels, Events, dunkle Karten"
              value={palette.surfaceDark}
              onChange={(hex) =>
                setKit((k) => (k ? patchPalette(k, { surfaceDark: hex }) : k))
              }
            />
            <FeedColorRow
              id="feed-light"
              label="Helle Fläche"
              hint="Ruhige Brand- / Signature-Posts"
              value={palette.surfaceLight}
              onChange={(hex) =>
                setKit((k) => (k ? patchPalette(k, { surfaceLight: hex }) : k))
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Foto-Look</Label>
          <p className="text-xs text-muted-foreground">
            Gleicher Grade auf allen Fotos im Feed.
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Foto-Look">
            {SOCIAL_PHOTO_LOOKS.map((look) => (
              <button
                key={look}
                type="button"
                className={cn(
                  "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  kit.photoLook === look
                    ? "border-accent/50 bg-accent/15 text-foreground"
                    : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
                )}
                aria-pressed={kit.photoLook === look}
                onClick={() =>
                  setKit((k) =>
                    k ? { ...k, photoLook: look as SocialPhotoLook } : k,
                  )
                }
              >
                {SOCIAL_PHOTO_LOOK_LABELS[look]}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {SOCIAL_PHOTO_LOOK_HINTS[kit.photoLook]}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Feed-Layouts</Label>
          <p className="text-xs text-muted-foreground">
            Mindestens eines — Autopilot rotiert nur in eurer Auswahl.
          </p>
          <div className="grid gap-2">
            {SOCIAL_FEED_LAYOUT_IDS.map((layoutId) => {
              const checked = kit.preferredLayouts.includes(layoutId);
              return (
                <label
                  key={layoutId}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
                    checked
                      ? "border-accent/40 bg-accent/5"
                      : "border-border/50 hover:border-border",
                  )}
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={checked}
                    onCheckedChange={(v) => {
                      const on = v === true;
                      setKit((k) => {
                        if (!k) return k;
                        return {
                          ...k,
                          preferredLayouts: togglePreferredFeedLayout(
                            k.preferredLayouts,
                            layoutId as SocialFeedLayoutId,
                            on,
                          ),
                        };
                      });
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {SOCIAL_FEED_LAYOUT_LABELS[layoutId]}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {SOCIAL_FEED_LAYOUT_HINTS[layoutId]}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Kanäle</Label>
          <p className="text-xs text-muted-foreground">
            Beim Freigeben nur verbundene Kanäle — Instagram, Facebook, Google,
            WhatsApp-Kanal und Gwada-Feed.
          </p>
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
                Zusätzlich Instagram- und Facebook-Story (wenn verbunden)
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
              setKit((k) =>
                k ? { ...k, neverAiFood: neverAiFood === true } : k,
              )
            }
          />
        </div>

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
            placeholder="z. B. familiär, keine Anglizismen, duzen, kurz, ohne Emoji"
          />
          <p className="text-[11px] text-muted-foreground">
            Stichworte steuern Ton: siezen/duzen, kurz, ohne Emoji, keine
            Anglizismen.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="social-gold">Gold-Captions</Label>
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
            placeholder={
              "Eine starke Zeile pro Zeile — z. B.\nSonntagsbraten bei uns.\nAbendlicht im Gastraum."
            }
          />
          <p className="text-[11px] text-muted-foreground">
            Agentur-taugliche Texte aus eurer Stimme. Enthält eine Caption den
            Gerichtnamen, hat sie Vorrang.
          </p>
        </div>

        {heroOptions.length > 0 ? (
          <div className="space-y-2">
            <Label>Hero-Fotos</Label>
            <p className="text-[11px] text-muted-foreground">
              Bis zu 8 Favoriten — Autopilot priorisiert sie für stimmige
              Beiträge.
            </p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {heroOptions.map((opt) => {
                const selected = kit.heroAssets.some(
                  (h) => h.source === opt.source && h.id === opt.sourceId,
                );
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-lg border transition-colors",
                      selected
                        ? "border-accent ring-2 ring-accent/40"
                        : "border-border/50 opacity-80 hover:opacity-100",
                    )}
                    aria-pressed={selected}
                    title={opt.label}
                    onClick={() =>
                      setKit((k) => {
                        if (!k) return k;
                        const exists = k.heroAssets.some(
                          (h) =>
                            h.source === opt.source && h.id === opt.sourceId,
                        );
                        if (exists) {
                          return {
                            ...k,
                            heroAssets: k.heroAssets.filter(
                              (h) =>
                                !(
                                  h.source === opt.source &&
                                  h.id === opt.sourceId
                                ),
                            ),
                          };
                        }
                        if (k.heroAssets.length >= 8) return k;
                        return {
                          ...k,
                          heroAssets: [
                            ...k.heroAssets,
                            {
                              source: opt.source,
                              id: opt.sourceId,
                              label: opt.label,
                            },
                          ],
                        };
                      })
                    }
                  >
                    {opt.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={opt.imageUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center bg-muted text-[10px] text-muted-foreground">
                        —
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {kit.heroAssets.length > 0 ? (
              <p className="text-[11px] text-muted-foreground">
                {kit.heroAssets.length}/8 ausgewählt
              </p>
            ) : null}
          </div>
        ) : null}

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
