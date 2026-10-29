"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { SocialAutopilotLivePreview } from "@/components/social/social-autopilot-live-preview";
import { SocialAutopilotLookDrawer } from "@/components/social/social-autopilot-look-drawer";
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import type { SocialAutopilotVoiceDraft } from "@/lib/social/social-autopilot-voice-draft";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import {
  autopilotPrimaryButtonClassName,
  autopilotSecondaryButtonClassName,
} from "@/lib/ui/social-autopilot-buttons";
import { cn } from "@/lib/utils";

function kitEqual(a: SocialBrandKit, b: SocialBrandKit): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function applyVoiceDraft(
  kit: SocialBrandKit,
  draft: SocialAutopilotVoiceDraft,
): SocialBrandKit {
  return {
    ...kit,
    voiceNotes: draft.voiceNotes,
    goldCaptions:
      draft.goldCaptions.length > 0 ? draft.goldCaptions : kit.goldCaptions,
    tone: draft.tone ?? kit.tone,
  };
}

/**
 * Autopilot-Einstellungen: eine visuelle Sprache, eine Live-Vorschau.
 * Aus Social lernen → Übernehmen (Formular) → Speichern; Verwerfen stellt
 * den gespeicherten Stil wieder her.
 */
export function SocialBrandKitCard({
  restaurantId,
  restaurantName,
  voiceDraft,
  voiceBusy,
  onLearnFromSocial,
  onClearVoiceDraft,
}: {
  restaurantId: string | null;
  restaurantName?: string;
  voiceDraft: SocialAutopilotVoiceDraft | null;
  voiceBusy: boolean;
  onLearnFromSocial: () => void | Promise<void>;
  onClearVoiceDraft: () => void;
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

  const previewKit = useMemo(() => {
    if (!kit) return null;
    if (!voiceDraft) return kit;
    return applyVoiceDraft(kit, voiceDraft);
  }, [kit, voiceDraft]);

  const dirty = useMemo(() => {
    if (!kit || !saved) return false;
    return !kitEqual(kit, saved);
  }, [kit, saved]);

  const discardForm = () => {
    if (!saved) return;
    setKit(saved);
    onClearVoiceDraft();
    toast.message("Änderungen verworfen");
  };

  const acceptVoiceDraft = () => {
    if (!kit || !voiceDraft) return;
    setKit(applyVoiceDraft(kit, voiceDraft));
    onClearVoiceDraft();
    toast.success("Vorschlag übernommen — noch Speichern tippen");
  };

  const discardVoiceDraft = () => {
    onClearVoiceDraft();
    toast.message("Vorschlag verworfen — gespeicherter Stil bleibt");
  };

  const save = async () => {
    if (!restaurantId || !kit) return;
    if (voiceDraft) {
      toast.message("Zuerst Vorschlag übernehmen oder verwerfen");
      return;
    }
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

  if (showSkeleton || !kit || !previewKit) {
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
  const formLocked = Boolean(voiceDraft);

  return (
    <>
      <div className="space-y-5 pb-24">
        <Card className="border-border/50 shadow-card">
          <CardContent className="space-y-4 pt-5">
            <SocialAutopilotLivePreview
              kit={previewKit}
              restaurantName={restaurantName}
              badge={voiceDraft ? "Vorschlag" : dirty ? "Entwurf" : null}
            />
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-card">
          <CardContent className="space-y-3 pt-5">
            <div className="space-y-1">
              <p className="text-sm font-medium">Aus Social lernen</p>
              <p className="text-sm text-muted-foreground">
                Liest eure letzten Instagram- und Facebook-Texte und schlägt
                Stimme vor. Speichern erst nach „Übernehmen“.
              </p>
            </div>

            {voiceDraft ? (
              <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-3">
                <p className="text-xs font-medium text-foreground">
                  Vorschlag aus {voiceDraft.sampleCount} Posts
                  {voiceDraft.fromLlm ? "" : " (ohne KI)"}
                </p>
                {voiceDraft.tone ? (
                  <p className="text-xs text-muted-foreground">
                    Ton: {SOCIAL_TONE_LABELS[voiceDraft.tone]}
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                  {voiceDraft.voiceNotes}
                </p>
                {voiceDraft.goldCaptions.length > 0 ? (
                  <ul className="space-y-1.5">
                    {voiceDraft.goldCaptions.slice(0, 3).map((c) => (
                      <li
                        key={c}
                        className="rounded-lg bg-background/60 px-2 py-1.5 text-[11px] text-muted-foreground"
                      >
                        „{c}“
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    className={autopilotPrimaryButtonClassName}
                    disabled={voiceBusy}
                    onClick={acceptVoiceDraft}
                  >
                    Übernehmen
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={autopilotSecondaryButtonClassName}
                    disabled={voiceBusy}
                    onClick={discardVoiceDraft}
                  >
                    Verwerfen
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Verwerfen stellt euren aktuellen/gespeicherten Stil wieder her
                  — nichts bleibt hängen.
                </p>
              </div>
            ) : (
              <Button
                type="button"
                className={autopilotPrimaryButtonClassName}
                disabled={voiceBusy || !kit}
                onClick={() => void onLearnFromSocial()}
              >
                {voiceBusy ? "Lese eure Posts …" : "Aus Social lernen"}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-card">
          <CardContent className="space-y-8 pt-5">
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
                  disabled={formLocked}
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
                  disabled={formLocked}
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

            <section className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Schreibstil</p>
                <p className="text-xs text-muted-foreground">
                  Ton und Stimme — Vorschau oben aktualisiert sich live.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Ton</Label>
                <Select
                  value={kit.tone}
                  disabled={formLocked}
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
                  disabled={formLocked}
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
                  disabled={formLocked}
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
                  disabled={formLocked}
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
                  disabled={formLocked}
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
                  disabled={formLocked}
                  value={kit.doNot}
                  onChange={(e) =>
                    setKit((k) => (k ? { ...k, doNot: e.target.value } : k))
                  }
                  className="min-h-20 rounded-xl"
                  placeholder="z. B. kein Discount-Ton"
                />
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-sm font-medium">Aussehen</p>
              <button
                type="button"
                disabled={formLocked}
                onClick={() => setLookOpen(true)}
                className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3.5 text-left text-sm touch-manipulation transition-colors hover:border-border disabled:opacity-60"
              >
                <span className="min-w-0 truncate text-muted-foreground">
                  {lookSummary}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </section>

            <section className="space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Kanäle</p>
                <p className="text-xs text-muted-foreground">
                  Standard beim Freigeben — Vorschau zeigt die Auswahl.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {allSocialPublishPlatformOptions().map((opt) => {
                  const checked = kit.publishPlatforms.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm",
                        formLocked && "opacity-60",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={formLocked}
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
                  disabled={formLocked}
                  onCheckedChange={(v) =>
                    setKit((k) =>
                      k ? { ...k, publishStories: v === true } : k,
                    )
                  }
                />
              </div>
            </section>
          </CardContent>
        </Card>
      </div>

      <SettingsStickySaveBar show={dirty || Boolean(voiceDraft)}>
        {voiceDraft ? (
          <>
            <Button
              type="button"
              variant="ghost"
              className="h-11 flex-1 rounded-xl text-muted-foreground sm:min-w-28 sm:flex-none"
              disabled={voiceBusy}
              onClick={discardVoiceDraft}
            >
              Verwerfen
            </Button>
            <Button
              type="button"
              className={cn(
                "h-11 flex-1 sm:min-w-36 sm:flex-none",
                settingsAccentSaveButtonClassName,
              )}
              disabled={voiceBusy}
              onClick={acceptVoiceDraft}
            >
              Übernehmen
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              className="h-11 flex-1 rounded-xl text-muted-foreground sm:min-w-28 sm:flex-none"
              disabled={saving}
              onClick={discardForm}
            >
              Verwerfen
            </Button>
            <Button
              type="button"
              disabled={!dirty || saving}
              className={cn(
                "h-11 flex-1 sm:min-w-36 sm:flex-none",
                settingsAccentSaveButtonClassName,
              )}
              onClick={() => void save()}
            >
              {saving ? "Speichern…" : "Speichern"}
            </Button>
          </>
        )}
      </SettingsStickySaveBar>

      <SocialAutopilotLookDrawer
        open={lookOpen}
        onOpenChange={setLookOpen}
        kit={kit}
        onChange={setKit}
      />
    </>
  );
}
