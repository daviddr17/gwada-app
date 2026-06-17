"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
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
import { cn } from "@/lib/utils";

const ACCEPT_IMAGES =
  "image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon";

function BrandingAssetField({
  title,
  description,
  previewUrl,
  onUpload,
  onRemove,
  uploading,
}: {
  title: string;
  description: string;
  previewUrl: string | null;
  onUpload: (file: File) => void;
  onRemove: () => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-border/50 bg-muted/5 p-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium leading-snug">{title}</p>
        <p className="text-xs leading-snug text-muted-foreground">{description}</p>
      </div>
      <div
        className={cn(
          "flex min-h-[4.5rem] items-center justify-center rounded-lg border border-dashed border-border/60 bg-background/60 p-2",
          previewUrl && "border-solid",
        )}
      >
        {previewUrl ? (
          <div className="relative flex max-h-12 w-full items-center justify-center">
            <Image
              src={previewUrl}
              alt=""
              width={120}
              height={48}
              unoptimized
              className="max-h-12 w-auto max-w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <ImageIcon className="size-5 opacity-60" />
            <span className="text-xs">Noch kein Bild</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_IMAGES}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onUpload(file);
        }}
      />
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-lg px-2.5 text-xs"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {previewUrl ? "Ersetzen" : "Hochladen"}
        </Button>
        {previewUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg px-2 text-xs text-destructive hover:text-destructive"
            disabled={uploading}
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
            Entfernen
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function PlatformAppGeneralPanel() {
  const { applyBranding, refresh } = usePlatformAppBranding();
  const [loading, setLoading] = useState(true);
  const [appName, setAppName] = useState(DEFAULT_PLATFORM_APP_NAME);
  const [savedAppName, setSavedAppName] = useState(DEFAULT_PLATFORM_APP_NAME);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoDarkUrl, setLogoDarkUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingLogoDark, setUploadingLogoDark] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSuperadminPlatformAppSettings();
      setAppName(data.appName);
      setSavedAppName(data.appName);
      setLogoUrl(data.logoUrl);
      setLogoDarkUrl(data.logoDarkUrl);
      setFaviconUrl(data.faviconUrl);
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
    setLogoUrl(data.logoUrl);
    setLogoDarkUrl(data.logoDarkUrl);
    setFaviconUrl(data.faviconUrl);
    applyBranding(data);
  };

  const handleUpload = async (kind: PlatformBrandingAssetKind, file: File) => {
    uploadBusyByKind[kind](true);
    try {
      const data = await uploadSuperadminPlatformBrandingAsset(kind, file);
      syncBrandingFromResponse(data);
      await refresh();
      toast.success(uploadSuccessLabel[kind]);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Upload fehlgeschlagen.",
      );
    } finally {
      uploadBusyByKind[kind](false);
    }
  };

  const handleRemove = async (kind: PlatformBrandingAssetKind) => {
    uploadBusyByKind[kind](true);
    try {
      const data = await removeSuperadminPlatformBrandingAsset(kind);
      syncBrandingFromResponse(data);
      await refresh();
      toast.success(removeSuccessLabel[kind]);
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
              previewUrl={logoUrl}
              uploading={uploadingLogo}
              onUpload={(file) => void handleUpload("logo", file)}
              onRemove={() => void handleRemove("logo")}
            />
            <BrandingAssetField
              title="Logo (Dunkelmodus)"
              description="Dunkles Theme. Ohne eigenes Logo wird das Hellmodus-Logo genutzt."
              previewUrl={logoDarkUrl}
              uploading={uploadingLogoDark}
              onUpload={(file) => void handleUpload("logo_dark", file)}
              onRemove={() => void handleRemove("logo_dark")}
            />
            <BrandingAssetField
              title="Favicon"
              description="Browser-Tab: PNG, ICO oder SVG. In der Topzeile bitte PNG oder SVG."
              previewUrl={faviconUrl}
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
