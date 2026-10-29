"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  SocialAutopilotAssetPickerDrawer,
  type AutopilotAssetPick,
} from "@/components/social/social-autopilot-asset-picker-drawer";
import { SocialAutopilotOptionsDrawer } from "@/components/social/social-autopilot-options-drawer";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import type { SocialTone } from "@/lib/social/social-brand-kit";
import {
  SOCIAL_MEDIA_FORMATS,
  type SocialMediaFormatId,
} from "@/lib/social/social-media-formats";
import type { NewsPlatform } from "@/lib/constants/news-platforms";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { autopilotPrimaryButtonClassName } from "@/lib/ui/social-autopilot-buttons";
import { cn } from "@/lib/utils";

type Phase = "setup" | "creating";

type KiCue = {
  id: string;
  kind: "holiday" | "event";
  label: string;
  prompt: string;
  detail?: string;
};

/**
 * KI-Post: leichte Vorgaben → ein Generieren → ein Entwurf.
 * Kein Ideas-Preload, kein Pitch-LLM beim Tab-Öffnen.
 * Caption/Bild über Restaurant-KI (OpenAI/Grok aus Integrationen).
 */
export function SocialAutopilotGenerateDrawer({
  open,
  onOpenChange,
  restaurantId,
  aiConfigured,
  aiLabel,
  initialTone,
  initialPlatforms,
  initialFormat,
  onCreated,
  embedded = false,
  asNewsDrafts = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  aiConfigured: boolean | null;
  aiLabel: string;
  initialTone: SocialTone;
  initialPlatforms: NewsPlatform[];
  initialFormat: SocialMediaFormatId;
  onCreated: () => void | Promise<void>;
  embedded?: boolean;
  asNewsDrafts?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [userBrief, setUserBrief] = useState("");
  const [cues, setCues] = useState<KiCue[]>([]);
  const [cuesLoading, setCuesLoading] = useState(false);
  const [menuPick, setMenuPick] = useState<AutopilotAssetPick | null>(null);
  const [galleryPick, setGalleryPick] = useState<AutopilotAssetPick | null>(
    null,
  );
  const [menuPickerOpen, setMenuPickerOpen] = useState(false);
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);
  const [sessionTone, setSessionTone] = useState<SocialTone>(initialTone);
  const [sessionPlatforms, setSessionPlatforms] =
    useState<NewsPlatform[]>(initialPlatforms);
  const [sessionFormat, setSessionFormat] =
    useState<SocialMediaFormatId>(initialFormat);
  const [formatTouched, setFormatTouched] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const dismissAbortRef = useRef(false);
  const generateAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) {
      dismissAbortRef.current = true;
      generateAbortRef.current?.abort();
      generateAbortRef.current = null;
      setPhase("setup");
      setOptionsOpen(false);
      setMenuPickerOpen(false);
      setGalleryPickerOpen(false);
      setMenuPick(null);
      setGalleryPick(null);
      setUserBrief("");
      setCues([]);
      setFormatTouched(false);
      return;
    }
    dismissAbortRef.current = false;
    setPhase("setup");
    setMenuPick(null);
    setGalleryPick(null);
    setUserBrief("");
    setFormatTouched(false);
  }, [open]);

  useEffect(() => {
    if (!open || phase !== "setup") return;
    setSessionTone(initialTone);
    setSessionPlatforms(
      initialPlatforms.length > 0
        ? [...initialPlatforms]
        : ["instagram", "facebook"],
    );
    if (!formatTouched) setSessionFormat(initialFormat);
  }, [
    open,
    phase,
    initialTone,
    initialPlatforms,
    initialFormat,
    formatTouched,
  ]);

  // Feiertage/Events — leicht, kein LLM (erst wenn Sheet offen).
  useEffect(() => {
    if (!open || !restaurantId) return;
    let cancelled = false;
    setCuesLoading(true);
    void fetch(
      `/api/social/ki-cues?restaurantId=${encodeURIComponent(restaurantId)}`,
    )
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          cues?: KiCue[];
        };
        if (!cancelled) setCues(Array.isArray(data.cues) ? data.cues : []);
      })
      .catch(() => {
        if (!cancelled) setCues([]);
      })
      .finally(() => {
        if (!cancelled) setCuesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, restaurantId]);

  useEffect(() => {
    return () => {
      dismissAbortRef.current = true;
      generateAbortRef.current?.abort();
    };
  }, []);

  const platformsSummary =
    sessionPlatforms.length === 0
      ? "Keine Kanäle"
      : sessionPlatforms.length <= 2
        ? sessionPlatforms.join(", ")
        : `${sessionPlatforms.length} Kanäle`;

  const generateOne = async () => {
    if (!restaurantId) return;
    if (aiConfigured === false) {
      toast.error("Bitte zuerst KI unter Integrationen verbinden");
      return;
    }

    dismissAbortRef.current = false;
    generateAbortRef.current?.abort();
    const controller = new AbortController();
    generateAbortRef.current = controller;

    setPhase("creating");
    const menuIds = menuPick ? [menuPick.sourceId] : [];
    const galleryIds = galleryPick ? [galleryPick.sourceId] : [];
    const brief = userBrief.trim();
    const styleOnly =
      menuIds.length === 0 && galleryIds.length === 0;

    try {
      const res = await fetch("/api/social/suggestions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          restaurantId,
          menuIds,
          galleryIds,
          styleOnly,
          userBrief: brief || undefined,
          count: 1,
          tone: sessionTone,
          platforms: sessionPlatforms,
          mediaFormat: sessionFormat,
          asNewsDrafts,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        generation?: {
          created?: number;
          newsDraftsCreated?: number;
          skippedReason?: string;
        };
        error?: string;
      };

      if (controller.signal.aborted || dismissAbortRef.current) return;

      if (!res.ok && data.error === "selection_required") {
        toast.error("Bitte Vorgaben prüfen");
        setPhase("setup");
        return;
      }
      const gen = data.generation;
      if (gen?.skippedReason === "ai_not_configured") {
        toast.error("Bitte zuerst KI unter Integrationen verbinden");
        setPhase("setup");
        return;
      }
      if (gen?.skippedReason === "needs_media") {
        toast.error(
          "Dafür fehlt noch ein Foto — Speisekarte, Galerie oder Titelbild",
        );
        setPhase("setup");
        return;
      }
      if (gen?.skippedReason === "week_full") {
        toast.message("Genug für diese Woche — erst Entwürfe posten");
        setPhase("setup");
        return;
      }
      if (gen?.skippedReason === "disabled") {
        toast.error("Autopilot ist aus — unter Autopilot-Einstellungen an");
        setPhase("setup");
        return;
      }

      const drafts =
        typeof gen?.newsDraftsCreated === "number"
          ? gen.newsDraftsCreated
          : (gen?.created ?? 0);
      if (drafts > 0) {
        toast.success(
          "Entwurf in der News-Liste — dort freigeben oder bearbeiten",
        );
        onOpenChange(false);
        void onCreated();
        return;
      }
      toast.message("Kein Entwurf erstellt");
      setPhase("setup");
    } catch (err) {
      if (
        dismissAbortRef.current ||
        (err instanceof DOMException && err.name === "AbortError")
      ) {
        return;
      }
      toast.error("Generieren fehlgeschlagen");
      setPhase("setup");
    } finally {
      if (generateAbortRef.current === controller) {
        generateAbortRef.current = null;
      }
    }
  };

  const setupBody = (
    <>
      <div
        className={cn(
          embedded
            ? "min-h-0 flex-1 space-y-5 overflow-y-auto px-1"
            : cn(drawerScrollAreaClassName(6), "space-y-5"),
        )}
      >
        <div className="space-y-2">
          <Label htmlFor="ki-post-brief" className="text-sm font-medium">
            Was soll die KI schreiben?
          </Label>
          <Textarea
            id="ki-post-brief"
            value={userBrief}
            onChange={(e) => setUserBrief(e.target.value.slice(0, 500))}
            className="min-h-24 rounded-xl"
            placeholder="z. B. Sonntagsbrunch bewerben, Sommerterrasse, neues Gericht …"
          />
          <p className="text-xs text-muted-foreground">
            Freitext optional — zusammen mit Speisekarte/Galerie und Stil.
          </p>
        </div>

        {(cuesLoading || cues.length > 0) && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Ideen</p>
            {cuesLoading && cues.length === 0 ? (
              <div className="flex gap-2 overflow-hidden" aria-busy>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-9 w-28 shrink-0 rounded-full" />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {cues.map((cue) => (
                  <button
                    key={cue.id}
                    type="button"
                    onClick={() => setUserBrief(cue.prompt.slice(0, 500))}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-left text-xs font-medium text-foreground touch-manipulation transition-colors hover:border-border"
                  >
                    <span className="truncate">{cue.label}</span>
                    {cue.detail ? (
                      <span className="shrink-0 text-muted-foreground">
                        · {cue.detail}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Medien</p>
          <p className="text-sm text-muted-foreground">
            Speisekarte und Galerie optional. Ohne Auswahl schreibt die KI im
            euren Stil (Marke).
          </p>

          <button
            type="button"
            onClick={() => setMenuPickerOpen(true)}
            className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3.5 text-left text-sm touch-manipulation transition-colors hover:border-border"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              {menuPick?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={menuPick.imageUrl}
                  alt=""
                  className="size-8 shrink-0 rounded-lg object-cover"
                />
              ) : null}
              <span className="min-w-0 truncate">
                <span className="font-medium text-foreground">Speisekarte</span>
                <span className="text-muted-foreground">
                  {" · "}
                  {menuPick?.label ?? "optional"}
                </span>
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>

          <button
            type="button"
            onClick={() => setGalleryPickerOpen(true)}
            className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3.5 text-left text-sm touch-manipulation transition-colors hover:border-border"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              {galleryPick?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={galleryPick.imageUrl}
                  alt=""
                  className="size-8 shrink-0 rounded-lg object-cover"
                />
              ) : null}
              <span className="min-w-0 truncate">
                <span className="font-medium text-foreground">Galerie</span>
                <span className="text-muted-foreground">
                  {" · "}
                  {galleryPick?.label ?? "optional"}
                </span>
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Kanäle & Format</p>
          <button
            type="button"
            onClick={() => setOptionsOpen(true)}
            className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3.5 text-left text-sm touch-manipulation transition-colors hover:border-border"
          >
            <span className="min-w-0 truncate text-muted-foreground">
              {platformsSummary}
              {" · "}
              {SOCIAL_MEDIA_FORMATS[sessionFormat]?.ratioLabel ?? sessionFormat}
            </span>
            <span className="shrink-0 text-xs font-medium text-foreground">
              Ändern
            </span>
          </button>
          <p className="text-xs text-muted-foreground">
            {SOCIAL_MEDIA_FORMATS[sessionFormat]?.platformHint}
          </p>
        </div>

        {aiConfigured === false ? (
          <div className="space-y-2 rounded-xl border border-dashed border-border/60 px-3 py-4 text-center">
            <p className="text-sm font-medium">KI noch nicht verbunden</p>
            <p className="text-sm text-muted-foreground">
              OpenAI oder Grok unter Integrationen hinterlegen.
            </p>
            <Button
              type="button"
              className={autopilotPrimaryButtonClassName}
              render={<Link href={APP_ROUTES.settings.integrations} />}
            >
              KI verbinden
            </Button>
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "shrink-0 border-t border-border/50 py-3",
          embedded ? "px-0" : "px-6",
        )}
      >
        <Button
          type="button"
          className={autopilotPrimaryButtonClassName}
          disabled={aiConfigured === false}
          onClick={() => void generateOne()}
        >
          <Sparkles className="size-4" />
          Generieren
        </Button>
      </div>
    </>
  );

  const creatingBody = (
    <div
      className={cn(
        embedded
          ? "min-h-0 flex-1 space-y-4 overflow-y-auto px-1"
          : drawerScrollAreaClassName(6),
        !embedded && "space-y-4",
      )}
      aria-busy
    >
      <p className="text-sm text-muted-foreground">
        {aiLabel} schreibt einen Post für euch …
      </p>
      {[0, 1].map((i) => (
        <SkeletonCardFrame key={i} className="space-y-3">
          <Skeleton className="mx-auto aspect-square w-full max-w-xs rounded-xl" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-8 w-full" />
        </SkeletonCardFrame>
      ))}
    </div>
  );

  const mainBody = phase === "creating" ? creatingBody : setupBody;

  const sheets = (
    <>
      <SocialAutopilotAssetPickerDrawer
        open={menuPickerOpen && open}
        onOpenChange={setMenuPickerOpen}
        restaurantId={restaurantId}
        group="menu"
        selectedId={menuPick?.sourceId ?? null}
        onSelect={setMenuPick}
      />
      <SocialAutopilotAssetPickerDrawer
        open={galleryPickerOpen && open}
        onOpenChange={setGalleryPickerOpen}
        restaurantId={restaurantId}
        group="gallery"
        selectedId={galleryPick?.sourceId ?? null}
        onSelect={setGalleryPick}
      />
      <SocialAutopilotOptionsDrawer
        open={optionsOpen && open && phase === "setup"}
        onOpenChange={setOptionsOpen}
        title="Kanäle & Format"
        tone={sessionTone}
        onToneChange={setSessionTone}
        platforms={sessionPlatforms}
        onPlatformsChange={setSessionPlatforms}
        format={sessionFormat}
        onFormatChange={(next) => {
          setFormatTouched(true);
          setSessionFormat(next);
        }}
        doneLabel="Fertig"
        onDone={() => setOptionsOpen(false)}
        defaults={{
          tone: initialTone,
          platforms:
            initialPlatforms.length > 0
              ? [...initialPlatforms]
              : ["instagram", "facebook"],
          format: initialFormat,
        }}
      />
    </>
  );

  if (embedded) {
    if (!open) return null;
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col">{mainBody}</div>
        {sheets}
      </>
    );
  }

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => {
          if (phase === "creating") return;
          onOpenChange(next);
        }}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className={drawerContentClassName("mediaTall")}>
          <DrawerHeader className="text-left">
            <DrawerTitle>
              {phase === "creating" ? "Einen Moment …" : "KI-Post"}
            </DrawerTitle>
            <DrawerDescription>
              {phase === "creating"
                ? `${aiLabel} schreibt einen Post für euch.`
                : "Vorgaben wählen — Generieren erstellt genau einen Entwurf."}
            </DrawerDescription>
          </DrawerHeader>
          {mainBody}
        </DrawerContent>
      </Drawer>
      {sheets}
    </>
  );
}
