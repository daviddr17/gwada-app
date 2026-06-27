"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ImageIcon, Trash2 } from "lucide-react";
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
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import { usePlatformAppBranding } from "@/lib/contexts/platform-app-branding-context";
import {
  fetchSuperadminPlatformAppSettings,
  patchSuperadminPlatformAppName,
  removeSuperadminPlatformBrandingAsset,
  uploadSuperadminPlatformBrandingAsset,
} from "@/lib/superadmin/platform-app-settings-api";
import {
  DEFAULT_PLATFORM_APP_NAME,
  type PlatformBrandingAssetKind,
} from "@/lib/types/platform-app-settings";
import { platformBrandingPreviewHref } from "@/lib/platform/branding-asset-url";
import { trackDashboardFileUpload } from "@/lib/uploads/dashboard-file-upload";
import { cn } from "@/lib/utils";

const ACCEPT_IMAGES =
  "image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon";

const ACCEPT_IMAGE_SET = new Set(
  ACCEPT_IMAGES.split(",").map((value) => value.trim()),
);

function isAcceptedBrandingFile(file: File): boolean {
  return ACCEPT_IMAGE_SET.has(file.type);
}

function BrandingAssetField({
  title,
  description,
  previewUrl,
  localPreviewUrl,
  onUpload,
  onRemove,
  uploading,
}: {
  title: string;
  description: string;
  previewUrl: string | null;
  localPreviewUrl?: string | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const displayPreviewUrl = localPreviewUrl ?? previewUrl;
  const hasPreview = Boolean(displayPreviewUrl);

  const pickFile = useCallback(
    (file: File | undefined) => {
      if (!file || uploading) return;
      if (!isAcceptedBrandingFile(file)) {
        toast.error("Bitte PNG, JPEG, WebP, SVG oder ICO wählen (max. 2 MB).");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Die Datei darf maximal 2 MB groß sein.");
        return;
      }
      onUpload(file);
    },
    [onUpload, uploading],
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (uploading) return;
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current += 1;
      if (e.dataTransfer.types.includes("Files")) {
        setIsDragOver(true);
      }
    },
    [uploading],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (uploading) return;
      if (!e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
    },
    [uploading],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragOver(false);
      if (uploading) return;
      pickFile(e.dataTransfer.files?.[0]);
    },
    [pickFile, uploading],
  );

  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-border/50 bg-muted/5 p-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium leading-snug">{title}</p>
        <p className="text-xs leading-snug text-muted-foreground">{description}</p>
      </div>
      <div className="relative">
        <button
          type="button"
          disabled={uploading}
          aria-label={
            hasPreview
              ? `${title}: Bild ersetzen`
              : `${title}: Bild hochladen`
          }
          className={cn(
            "group relative flex min-h-[5.5rem] w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/60 p-3 text-center transition-colors",
            hasPreview && "border-solid",
            !uploading &&
              "hover:border-accent/40 hover:bg-accent/5 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            isDragOver && "border-accent bg-accent/10 ring-2 ring-accent/30",
            uploading && "cursor-wait opacity-80",
          )}
          onClick={() => inputRef.current?.click()}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {uploading && localPreviewUrl ? (
            <div className="relative flex max-h-14 w-full items-center justify-center opacity-70">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={localPreviewUrl}
                alt=""
                className="max-h-14 w-auto max-w-full object-contain"
              />
            </div>
          ) : hasPreview ? (
            <div className="relative flex max-h-14 w-full items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayPreviewUrl!}
                alt=""
                className="max-h-14 w-auto max-w-full object-contain"
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-lg bg-background/80 px-2 py-1 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                Klicken zum Ersetzen
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
              <ImageIcon className="size-5 opacity-60" aria-hidden />
              <span className="max-w-[12rem] text-xs leading-snug">
                Noch kein Bild. Klicken zum Hochladen.
              </span>
            </div>
          )}
        </button>
        {previewUrl && !uploading ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1.5 right-1.5 z-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`${title} entfernen`}
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_IMAGES}
        className="sr-only"
        disabled={uploading}
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function PlatformAppGeneralPanel() {
  const { applyBranding, refresh } = usePlatformAppBranding();
  const [loading, setLoading] = useState(true);
  const [appName, setAppName] = useState(DEFAULT_PLATFORM_APP_NAME);
  const [savedAppName, setSavedAppName] = useState(DEFAULT_PLATFORM_APP_NAME);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoDarkPath, setLogoDarkPath] = useState<string | null>(null);
  const [faviconPath, setFaviconPath] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingLogoDark, setUploadingLogoDark] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [localPreviewByKind, setLocalPreviewByKind] = useState<
    Partial<Record<PlatformBrandingAssetKind, string>>
  >({});

  const clearLocalPreview = (kind: PlatformBrandingAssetKind) => {
    setLocalPreviewByKind((prev) => {
      const next = { ...prev };
      const url = next[kind];
      if (url) URL.revokeObjectURL(url);
      delete next[kind];
      return next;
    });
  };

  const setLocalPreview = (kind: PlatformBrandingAssetKind, file: File) => {
    clearLocalPreview(kind);
    setLocalPreviewByKind((prev) => ({
      ...prev,
      [kind]: URL.createObjectURL(file),
    }));
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSuperadminPlatformAppSettings();
      setAppName(data.appName);
      setSavedAppName(data.appName);
      setLogoPath(data.logoPath);
      setLogoDarkPath(data.logoDarkPath);
      setFaviconPath(data.faviconPath);
      applyBranding(data);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Einstellungen konnten nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }, [applyBranding]);

  useEffect(() => {
    void load();
  }, [load]);

  const nameDirty = useMemo(
    () => appName.trim() !== savedAppName.trim(),
    [appName, savedAppName],
  );

  const handleSaveName = async () => {
    const name = appName.trim();
    if (!name) {
      toast.error("Bitte einen App-Namen eingeben.");
      return;
    }
    setSavingName(true);
    try {
      const data = await patchSuperadminPlatformAppName(name);
      setAppName(data.appName);
      setSavedAppName(data.appName);
      applyBranding(data);
      await refresh();
      toast.success("App-Name gespeichert.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Speichern fehlgeschlagen.",
      );
    } finally {
      setSavingName(false);
    }
  };

  const uploadBusyByKind: Record<
    PlatformBrandingAssetKind,
    (v: boolean) => void
  > = {
    logo: setUploadingLogo,
    logo_dark: setUploadingLogoDark,
    favicon: setUploadingFavicon,
  };

  const uploadSuccessLabel: Record<PlatformBrandingAssetKind, string> = {
    logo: "Logo (Hellmodus) gespeichert.",
    logo_dark: "Logo (Dunkelmodus) gespeichert.",
    favicon: "Favicon gespeichert.",
  };

  const removeSuccessLabel: Record<PlatformBrandingAssetKind, string> = {
    logo: "Logo (Hellmodus) entfernt.",
    logo_dark: "Logo (Dunkelmodus) entfernt.",
    favicon: "Favicon entfernt.",
  };

  const syncBrandingFromResponse = (
    data: Awaited<ReturnType<typeof fetchSuperadminPlatformAppSettings>>,
  ) => {
    setLogoPath(data.logoPath);
    setLogoDarkPath(data.logoDarkPath);
    setFaviconPath(data.faviconPath);
    applyBranding(data);
  };

  const handleUpload = async (kind: PlatformBrandingAssetKind, file: File) => {
    uploadBusyByKind[kind](true);
    setLocalPreview(kind, file);
    try {
      const data = await trackDashboardFileUpload(
        () =>
          uploadSuperadminPlatformBrandingAsset(kind, file).then((settings) => ({
            error: null as string | null,
            settings,
          })),
        { successMessage: uploadSuccessLabel[kind] },
      );
      syncBrandingFromResponse(data.settings);
      await refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Upload fehlgeschlagen.",
      );
    } finally {
      clearLocalPreview(kind);
      uploadBusyByKind[kind](false);
    }
  };

  const handleRemove = async (kind: PlatformBrandingAssetKind) => {
    uploadBusyByKind[kind](true);
    try {
      const data = await trackDashboardFileUpload(
        () =>
          removeSuperadminPlatformBrandingAsset(kind).then((settings) => ({
            error: null as string | null,
            settings,
          })),
        { successMessage: removeSuccessLabel[kind] },
      );
      syncBrandingFromResponse(data.settings);
      await refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Entfernen fehlgeschlagen.",
      );
    } finally {
      uploadBusyByKind[kind](false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-[12rem] rounded-2xl border border-border/50 bg-card/50"
        aria-busy
      />
    );
  }

  return (
    <>
      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">App-Branding</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Name, Logos und Favicon für Browser-Tab, Startseite und App-Oberfläche.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-border/50 bg-muted/5 p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium leading-snug">App-Name</p>
                <p className="text-xs leading-snug text-muted-foreground">
                  Erscheint im Tab und überall, wo der Plattformname angezeigt wird.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="platform-app-name" className="text-xs">
                  Name
                </Label>
                <Input
                  id="platform-app-name"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  maxLength={80}
                  className="h-9 rounded-lg text-sm"
                  placeholder={DEFAULT_PLATFORM_APP_NAME}
                />
              </div>
            </div>

            <BrandingAssetField
              title="Logo (Hellmodus)"
              description="Helles Theme: Top-Menü, Startseite, App. PNG, JPEG, WebP oder SVG, max. 2 MB."
              previewUrl={platformBrandingPreviewHref(logoPath)}
              localPreviewUrl={localPreviewByKind.logo}
              uploading={uploadingLogo}
              onUpload={(file) => void handleUpload("logo", file)}
              onRemove={() => void handleRemove("logo")}
            />
            <BrandingAssetField
              title="Logo (Dunkelmodus)"
              description="Dunkles Theme. Ohne eigenes Logo wird das Hellmodus-Logo genutzt."
              previewUrl={platformBrandingPreviewHref(logoDarkPath)}
              localPreviewUrl={localPreviewByKind.logo_dark}
              uploading={uploadingLogoDark}
              onUpload={(file) => void handleUpload("logo_dark", file)}
              onRemove={() => void handleRemove("logo_dark")}
            />
            <BrandingAssetField
              title="Favicon"
              description="Browser-Tab: PNG, ICO oder SVG. In der Topzeile bitte PNG oder SVG."
              previewUrl={platformBrandingPreviewHref(faviconPath)}
              localPreviewUrl={localPreviewByKind.favicon}
              uploading={uploadingFavicon}
              onUpload={(file) => void handleUpload("favicon", file)}
              onRemove={() => void handleRemove("favicon")}
            />
          </div>
        </CardContent>
      </Card>

      <SettingsStickySaveBar show={nameDirty}>
        <Button
          type="button"
          className={cn("rounded-xl", settingsAccentSaveButtonClassName)}
          disabled={savingName}
          onClick={() => void handleSaveName()}
        >
          App-Name speichern
        </Button>
      </SettingsStickySaveBar>
    </>
  );
}
