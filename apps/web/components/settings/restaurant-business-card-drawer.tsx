"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RestaurantBusinessCardLayoutEditor } from "@/components/settings/restaurant-business-card-layout-editor";
import { BusinessCardExportPortal } from "@/components/settings/business-card-export-portal";
import { BusinessCardFontLinks } from "@/components/settings/business-card-font-links";
import {
  AppFullscreenOverlay,
  appFullscreenOverlayScrollClassName,
} from "@/components/ui/app-fullscreen-overlay";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  BUSINESS_CARD_ELEMENT_DEFS,
  BUSINESS_CARD_FORMAT_OPTIONS,
  businessCardOptionsFromDesign,
  createDefaultBusinessCardDesign,
  loadStoredBusinessCardDesign,
  saveStoredBusinessCardDesign,
  setBusinessCardElementEnabled,
  setBusinessCardFormat,
  updateBusinessCardElement,
  type BusinessCardDesign,
  type BusinessCardElementType,
  type BusinessCardFormatId,
  type BusinessCardSide,
} from "@/lib/restaurant/business-card-design";
import {
  buildBusinessCardContent,
  businessCardElementMissingDataHint,
  businessCardPdfFileName,
} from "@/lib/restaurant/business-card-layout";
import {
  buildBusinessCardPdfFromImages,
  businessCardExportHeightPx,
  captureBusinessCardFaces,
  urlToDataUrl,
  waitForImages,
  waitFrames,
} from "@/lib/restaurant/capture-business-card-pdf";
import { prepareBusinessCardLogoBadgeForExport } from "@/lib/restaurant/business-card-logo-badge";
import {
  prepareBusinessCardDesignForExport,
} from "@/lib/restaurant/business-card-decoration-document";
import { businessCardPresetArtDirection } from "@/lib/restaurant/business-card-art-direction";
import { businessCardFormatAspect } from "@/lib/restaurant/business-card-design";
import {
  fetchBusinessCardDesignClient,
  saveBusinessCardDesignClient,
} from "@/lib/restaurant/business-card-design-api";
import { generateBusinessCardQrDataUrl } from "@/lib/restaurant/business-card-qr";
import {
  applyBusinessCardPreset,
  BUSINESS_CARD_PRESET_OPTIONS,
} from "@/lib/restaurant/business-card-presets";
import { businessCardPresetSwatchStyle } from "@/lib/restaurant/business-card-preset-swatch";
import {
  BUSINESS_CARD_TYPOGRAPHY_OPTIONS,
  type BusinessCardTypographyId,
} from "@/lib/restaurant/business-card-typography";
import type { BusinessCardPresetId } from "@/lib/restaurant/business-card-design";
import {
  downloadRestaurantProfileImageAsDataUrl,
  resolveRestaurantProfileImageSignedUrl,
} from "@/lib/restaurant/restaurant-profile-image";
import { useAppFaviconDisplay } from "@/lib/hooks/use-app-favicon-src";
import { EMBED_BRAND_FOOTER_LOGO_PATH } from "@/lib/embed/embed-brand-footer";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { RestaurantProfile } from "@/lib/types/restaurant";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { normalizeHex } from "@/lib/theme/color-utils";
import { cn } from "@/lib/utils";

const ELEMENT_TYPES = Object.keys(
  BUSINESS_CARD_ELEMENT_DEFS,
) as BusinessCardElementType[];

const SIDE_OPTIONS: { value: BusinessCardSide; label: string }[] = [
  { value: "front", label: "Vorderseite" },
  { value: "back", label: "Rückseite" },
];

const COLOR_FIELDS: Array<{
  key: keyof BusinessCardDesign["colors"];
  label: string;
  hint?: string;
}> = [
  { key: "accent", label: "Akzent", hint: "Aus Branding — Unterstreichung, Links" },
  { key: "background", label: "Hintergrund" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Sekundärtext" },
];

export function RestaurantBusinessCardDrawer({
  open,
  onOpenChange,
  profile,
  accentHex,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: RestaurantProfile;
  accentHex: string;
}) {
  const [design, setDesign] = useState<BusinessCardDesign>(() =>
    createDefaultBusinessCardDesign(accentHex),
  );
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [exportCoverUrl, setExportCoverUrl] = useState<string | null>(null);
  const [exportLogoUrl, setExportLogoUrl] = useState<string | null>(null);
  const [exportLogoBadgeUrl, setExportLogoBadgeUrl] = useState<string | null>(null);
  const [exportGwadaFaviconUrl, setExportGwadaFaviconUrl] = useState<string | null>(null);
  const [exportQrCodeUrl, setExportQrCodeUrl] = useState<string | null>(null);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [exportDesign, setExportDesign] = useState<BusinessCardDesign | null>(null);
  const { src: gwadaFaviconSrc } = useAppFaviconDisplay();
  const exportFrontRef = useRef<HTMLDivElement>(null);
  const exportBackRef = useRef<HTMLDivElement>(null);
  const designHydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const designRef = useRef(design);
  designRef.current = design;

  const hasCoverImage = Boolean(profile.coverStoragePath?.trim());
  const gwadaFaviconUrl =
    gwadaFaviconSrc ?? EMBED_BRAND_FOOTER_LOGO_PATH;

  useEffect(() => {
    if (!open) {
      if (designHydratedRef.current) {
        saveStoredBusinessCardDesign(profile.id, designRef.current);
        void saveBusinessCardDesignClient(profile.id, designRef.current);
      }
      designHydratedRef.current = false;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;
    designHydratedRef.current = false;

    void (async () => {
      const [fromServer, fromLocal] = await Promise.all([
        fetchBusinessCardDesignClient(profile.id),
        Promise.resolve(loadStoredBusinessCardDesign(profile.id)),
      ]);

      if (cancelled) return;

      const base =
        fromServer ??
        fromLocal ??
        createDefaultBusinessCardDesign(accentHex, { hasCoverImage });

      setDesign({
        ...base,
        colors: {
          ...base.colors,
          accent: normalizeHex(accentHex) ?? base.colors.accent,
        },
      });

      designHydratedRef.current = true;

      if (!fromServer && fromLocal) {
        void saveBusinessCardDesignClient(profile.id, fromLocal);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, profile.id, accentHex, hasCoverImage]);

  useEffect(() => {
    if (!open || !designHydratedRef.current) return;

    saveStoredBusinessCardDesign(profile.id, design);

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void saveBusinessCardDesignClient(profile.id, design).then((result) => {
        if (!result.ok) {
          console.warn("[business-card-design] save failed", result.error);
        }
      });
    }, 600);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [open, profile.id, design]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const sb = createSupabaseBrowserClient();

    void (async () => {
      const [cover, logo] = await Promise.all([
        profile.coverStoragePath
          ? resolveRestaurantProfileImageSignedUrl(sb, profile.coverStoragePath)
          : Promise.resolve(null),
        profile.avatarStoragePath
          ? resolveRestaurantProfileImageSignedUrl(sb, profile.avatarStoragePath)
          : Promise.resolve(null),
      ]);
      if (!cancelled) {
        setCoverUrl(cover);
        setLogoUrl(logo);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, profile.avatarStoragePath, profile.coverStoragePath]);

  const options = useMemo(
    () => businessCardOptionsFromDesign(design),
    [design],
  );

  const content = useMemo(
    () => buildBusinessCardContent(profile, options),
    [profile, options],
  );

  useEffect(() => {
    if (!open || !options.showQrCode || !content.websiteHref) {
      setQrPreviewUrl(null);
      return;
    }

    let cancelled = false;
    void generateBusinessCardQrDataUrl(content.websiteHref, design.colors.accent).then(
      (url) => {
        if (!cancelled) setQrPreviewUrl(url);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [open, options.showQrCode, content.websiteHref, design.colors.accent]);

  const applyPreset = useCallback(
    (presetId: BusinessCardPresetId) => {
      setDesign((prev) =>
        applyBusinessCardPreset(prev, presetId, accentHex, { hasCoverImage }),
      );
      toast.success("Stil-Vorlage angewendet.");
    },
    [accentHex, hasCoverImage],
  );

  const setEnabled = useCallback(
    (type: BusinessCardElementType, enabled: boolean) => {
      setDesign((prev) => setBusinessCardElementEnabled(prev, type, enabled));
    },
    [],
  );

  const setSide = useCallback((type: BusinessCardElementType, side: BusinessCardSide) => {
    setDesign((prev) => {
      const el = prev.elements.find((e) => e.type === type);
      if (!el) return prev;
      return updateBusinessCardElement(prev, el.id, { side });
    });
  }, []);

  const setColor = useCallback(
    (key: keyof BusinessCardDesign["colors"], value: string) => {
      setDesign((prev) => ({
        ...prev,
        colors: { ...prev.colors, [key]: value },
      }));
    },
    [],
  );

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const sb = createSupabaseBrowserClient();
      const effectiveCover =
        options.showCover && hasCoverImage ? coverUrl : null;
      const effectiveLogo = options.showLogo ? logoUrl : null;
      const effectiveGwadaFavicon = options.showGwadaFavicon ? gwadaFaviconUrl : null;
      const effectiveQr =
        options.showQrCode && content.websiteHref ? content.websiteHref : null;

      const [coverData, logoData, faviconData, qrData, designForExport] =
        await Promise.all([
          effectiveCover && profile.coverStoragePath
            ? downloadRestaurantProfileImageAsDataUrl(sb, profile.coverStoragePath)
            : effectiveCover
              ? urlToDataUrl(effectiveCover)
              : Promise.resolve(null),
          effectiveLogo && profile.avatarStoragePath
            ? downloadRestaurantProfileImageAsDataUrl(sb, profile.avatarStoragePath)
            : effectiveLogo
              ? urlToDataUrl(effectiveLogo)
              : Promise.resolve(null),
          urlToDataUrl(effectiveGwadaFavicon),
          effectiveQr
            ? generateBusinessCardQrDataUrl(effectiveQr, design.colors.accent)
            : Promise.resolve(null),
          prepareBusinessCardDesignForExport(design, profile.id),
        ]);

      const cardHeightPx = businessCardExportHeightPx(design.formatId);
      const cardWidthPx = cardHeightPx * businessCardFormatAspect(design.formatId);
      const logoStyle = businessCardPresetArtDirection(design.presetId).logoStyle;
      const logoBadge =
        options.showLogo
          ? await prepareBusinessCardLogoBadgeForExport({
              logoUrl: logoData,
              initialsName: content.name,
              design: designForExport,
              cardWidthPx,
              cardHeightPx,
              logoStyle,
            })
          : null;

      flushSync(() => {
        setExportDesign(designForExport);
        setExportCoverUrl(coverData);
        setExportLogoUrl(logoData);
        setExportLogoBadgeUrl(logoBadge);
        setExportGwadaFaviconUrl(faviconData);
        setExportQrCodeUrl(qrData);
      });

      await waitFrames(5);
      await waitForImages(exportFrontRef.current ?? document.body);
      await waitForImages(exportBackRef.current ?? document.body);

      const frontEl = exportFrontRef.current;
      const backEl = exportBackRef.current;
      if (!frontEl || !backEl) {
        throw new Error("export_not_ready");
      }

      const { front, back } = await captureBusinessCardFaces(
        frontEl,
        backEl,
        design.formatId,
        design.typographyId,
      );
      const blob = await buildBusinessCardPdfFromImages(front, back, design.formatId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = businessCardPdfFileName(profile.slug);
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Visitenkarte heruntergeladen.");
    } catch (error) {
      console.error("[business-card-pdf]", error);
      toast.error("PDF konnte nicht erstellt werden.");
    } finally {
      setExportDesign(null);
      setExportCoverUrl(null);
      setExportLogoUrl(null);
      setExportLogoBadgeUrl(null);
      setExportGwadaFaviconUrl(null);
      setExportQrCodeUrl(null);
      setDownloading(false);
    }
  };

  const exportCover = exportCoverUrl;
  const exportLogo = exportLogoUrl;
  const exportLogoBadge = exportLogoBadgeUrl;
  const exportGwadaFavicon = exportGwadaFaviconUrl;
  const exportQr = exportQrCodeUrl;

  const formatOptions = BUSINESS_CARD_FORMAT_OPTIONS.map((f) => ({
    value: f.id,
    label: f.label,
  }));

  const typographyOptions = useMemo(
    () =>
      BUSINESS_CARD_TYPOGRAPHY_OPTIONS.map((typography) => ({
        value: typography.id,
        label: typography.label,
      })),
    [],
  );

  return (
    <AppFullscreenOverlay
      open={open}
      onClose={() => onOpenChange(false)}
      aria-label="Visitenkarte gestalten"
      header={
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-full"
            onClick={() => onOpenChange(false)}
          >
            <ArrowLeft className="size-5" />
            <span className="sr-only">Schließen</span>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">Visitenkarte gestalten</p>
            <p className="truncate text-xs text-muted-foreground">
              Format, Inhalte und Layout — PDF mit Vorder- und Rückseite
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex gap-3 px-4 py-3">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 rounded-xl tap-scale"
            onClick={() => onOpenChange(false)}
          >
            Schließen
          </Button>
          <Button
            type="button"
            className={cn("h-12 flex-1", brandActionButtonRoundedClassName)}
            disabled={downloading || !content.name.trim()}
            onClick={() => void handleDownload()}
          >
            {downloading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Wird erstellt …
              </>
            ) : (
              <>
                <Download className="size-4" />
                PDF herunterladen
              </>
            )}
          </Button>
        </div>
      }
    >
      {open ? <BusinessCardFontLinks /> : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row lg:items-stretch">
        <div
          className={cn(
            appFullscreenOverlayScrollClassName,
            "shrink-0 border-b border-border/50 px-4 py-4 lg:w-[min(100%,20rem)] lg:flex-none lg:basis-auto lg:border-b-0 lg:border-r",
          )}
        >
          <div className="w-full space-y-4">
            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold">Format</h3>
              <SearchableSelect
                value={design.formatId}
                onValueChange={(v) =>
                  setDesign((prev) =>
                    setBusinessCardFormat(prev, v as BusinessCardFormatId),
                  )
                }
                options={formatOptions}
                className={appSelectTriggerAccentCn("h-9 w-full text-xs")}
              />
            </section>

            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold">Schriftart</h3>
              <p className="text-[0.65rem] leading-snug text-muted-foreground">
                Typo für Name und Fließtext — unabhängig von der Stil-Vorlage
                anpassbar.
              </p>
              <SearchableSelect
                value={design.typographyId}
                onValueChange={(v) =>
                  setDesign((prev) => ({
                    ...prev,
                    typographyId: v as BusinessCardTypographyId,
                  }))
                }
                options={typographyOptions}
                className={appSelectTriggerAccentCn("h-9 w-full text-xs")}
              />
            </section>

            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold">Stil-Vorlage</h3>
              <p className="text-[0.65rem] leading-snug text-muted-foreground">
                Startlayout mit einem Klick — danach frei verschieben und anpassen.
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {BUSINESS_CARD_PRESET_OPTIONS.map((preset) => {
                  const active = design.presetId === preset.id;
                  const swatch = businessCardPresetSwatchStyle(preset, accentHex);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors",
                        active
                          ? "border-accent ring-1 ring-accent/30 bg-accent/5"
                          : "border-border/40 bg-muted/15 hover:bg-muted/25",
                      )}
                    >
                      <span
                        className="relative block h-8 w-11 shrink-0 overflow-hidden rounded-md border border-border/35 shadow-sm"
                        style={{ backgroundColor: swatch.backgroundColor }}
                        aria-hidden
                      >
                        {preset.id === "modern" || preset.id === "dark" ? (
                          <span
                            className="absolute inset-0"
                            style={{
                              background:
                                preset.id === "modern"
                                  ? `radial-gradient(ellipse 90% 75% at 0% 0%, ${swatch.accentColor}22 0%, transparent 55%)`
                                  : `radial-gradient(ellipse 95% 80% at 100% 0%, ${swatch.accentColor}33 0%, transparent 52%)`,
                            }}
                          />
                        ) : null}
                        {preset.accentStyle === "line" ? (
                          <span
                            className="absolute left-1.5 top-[1.15rem] h-px w-4 opacity-40"
                            style={{ backgroundColor: swatch.accentColor }}
                          />
                        ) : null}
                        {preset.accentStyle === "coverGradient" ? (
                          <span
                            className="absolute inset-0 opacity-80"
                            style={{
                              background: `linear-gradient(to top, ${swatch.backgroundColor} 10%, transparent 50%), linear-gradient(145deg, ${swatch.accentColor}88, ${swatch.mutedColor}55)`,
                            }}
                          />
                        ) : null}
                        <span
                          className="absolute left-1.5 top-1.5 h-1 w-6 rounded-sm opacity-90"
                          style={{ backgroundColor: swatch.textColor }}
                        />
                        <span
                          className="absolute left-1.5 top-[0.55rem] h-0.5 w-5 rounded-full opacity-45"
                          style={{ backgroundColor: swatch.mutedColor }}
                        />
                      </span>
                      <span className="min-w-0 text-[0.7rem] font-medium leading-tight">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold">Farben</h3>
              <div className="grid w-full grid-cols-1 gap-1.5 sm:grid-cols-2">
                {COLOR_FIELDS.map((field) => (
                  <div
                    key={field.key}
                    className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/15 px-2 py-1.5"
                  >
                    <input
                      type="color"
                      value={
                        normalizeHex(design.colors[field.key]) ??
                        design.colors[field.key]
                      }
                      onChange={(e) => setColor(field.key, e.target.value)}
                      className="size-9 shrink-0 cursor-pointer rounded-lg border border-border/60 bg-background p-0 shadow-none"
                      aria-label={`${field.label} wählen`}
                      title={field.hint}
                    />
                    <div className="min-w-0 flex-1">
                      <Label
                        className="text-[0.65rem] font-medium leading-none"
                        title={field.hint}
                      >
                        {field.label}
                      </Label>
                      <Input
                        value={design.colors[field.key]}
                        onChange={(e) => setColor(field.key, e.target.value)}
                        className="mt-1 h-7 rounded-lg font-mono text-[0.65rem]"
                        spellCheck={false}
                        maxLength={7}
                        aria-label={`${field.label} Hex`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-1.5">
              <h3 className="text-sm font-semibold">Inhalte</h3>
              <div className="grid w-full grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                {ELEMENT_TYPES.map((type) => {
                  const def = BUSINESS_CARD_ELEMENT_DEFS[type];
                  const el = design.elements.find((e) => e.type === type);
                  const missingHint = businessCardElementMissingDataHint(type, profile, {
                    hasCoverImage,
                  });
                  const dataMissing = Boolean(missingHint);
                  const enabled = el?.enabled ?? false;

                  return (
                    <div
                      key={type}
                      className={cn(
                        "flex w-full flex-col gap-1.5 rounded-lg border border-border/40 bg-muted/15 px-2.5 py-2",
                        dataMissing && "opacity-70",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <Label
                            htmlFor={`bc-${type}`}
                            className="text-xs font-medium leading-tight"
                          >
                            {def.label}
                          </Label>
                          <p className="mt-0.5 line-clamp-2 text-[0.65rem] leading-snug text-muted-foreground">
                            {missingHint ?? def.description}
                          </p>
                        </div>
                        <Switch
                          id={`bc-${type}`}
                          className="shrink-0"
                          checked={dataMissing ? false : enabled}
                          disabled={dataMissing || (!def.canDisable && enabled)}
                          onCheckedChange={(checked) =>
                            setEnabled(type, checked === true)
                          }
                        />
                      </div>
                      {enabled && !dataMissing ? (
                        <SearchableSelect
                          value={el?.side ?? def.defaultSide}
                          onValueChange={(v) =>
                            setSide(type, v as BusinessCardSide)
                          }
                          options={SIDE_OPTIONS}
                          className={appSelectTriggerAccentCn("h-7 w-full text-xs")}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        <div className="flex min-h-[min(50dvh,22rem)] min-w-0 flex-1 flex-col bg-muted/10 px-4 pt-2 pb-4 lg:min-h-0 lg:px-6 lg:pt-2.5">
          <RestaurantBusinessCardLayoutEditor
            design={design}
            onDesignChange={setDesign}
            content={content}
            coverUrl={hasCoverImage ? coverUrl : null}
            logoUrl={logoUrl}
            gwadaFaviconUrl={gwadaFaviconUrl}
            qrCodeUrl={qrPreviewUrl}
            restaurantId={profile.id}
            className="h-full min-h-0 flex-1"
          />
        </div>
      </div>

      {exportDesign ? (
        <BusinessCardExportPortal
          design={exportDesign}
          content={content}
          coverUrl={exportCover}
          logoUrl={exportLogo}
          logoBadgeUrl={exportLogoBadge}
          gwadaFaviconUrl={exportGwadaFavicon}
          qrCodeUrl={exportQr}
          restaurantId={profile.id}
          frontRef={exportFrontRef}
          backRef={exportBackRef}
        />
      ) : null}
    </AppFullscreenOverlay>
  );
}
