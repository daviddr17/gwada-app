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

function BrandingAssetCard({
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
    <Card className="border-border/50 shadow-card">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            "flex min-h-[7rem] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/15 p-4",
            previewUrl && "border-solid",
          )}
        >
          {previewUrl ? (
            <div className="relative flex max-h-24 w-full max-w-xs items-center justify-center">
              <Image
                src={previewUrl}
                alt=""
                width={160}
                height={80}
                unoptimized
                className="max-h-20 w-auto max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <ImageIcon className="size-8 opacity-60" />
              <span className="text-sm">Noch kein Bild hochgeladen</span>
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
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {previewUrl ? "Ersetzen" : "Hochladen"}
          </Button>
          {previewUrl ? (
            <Button
              type="button"
              variant="ghost"
              className="rounded-xl text-destructive hover:text-destructive"
              disabled={uploading}
              onClick={onRemove}
            >
              <Trash2 className="size-4" />
              Entfernen
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
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
        className="min-h-[20rem] rounded-2xl border border-border/50 bg-card/50"
        aria-busy
      />
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <Card className="border-border/50 shadow-card">
        <CardHeader>
          <CardTitle>App-Name</CardTitle>
          <CardDescription>
            Erscheint im Browser-Tab und überall, wo der Plattformname angezeigt
            wird (z. B. Startseite).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-md">
            <Label htmlFor="platform-app-name">Name</Label>
            <Input
              id="platform-app-name"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              maxLength={80}
              className="h-11 rounded-xl"
              placeholder={DEFAULT_PLATFORM_APP_NAME}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <BrandingAssetCard
          title="App-Logo (Hellmodus)"
          description="Für helles Theme: Top-Menü, Startseite und App-Oberfläche. PNG, JPEG, WebP oder SVG, max. 2 MB."
          previewUrl={logoUrl}
          uploading={uploadingLogo}
          onUpload={(file) => void handleUpload("logo", file)}
          onRemove={() => void handleRemove("logo")}
        />
        <BrandingAssetCard
          title="App-Logo (Dunkelmodus)"
          description="Für dunkles Theme. Ohne eigenes Logo wird das Hellmodus-Logo verwendet."
          previewUrl={logoDarkUrl}
          uploading={uploadingLogoDark}
          onUpload={(file) => void handleUpload("logo_dark", file)}
          onRemove={() => void handleRemove("logo_dark")}
        />
        <BrandingAssetCard
          title="Favicon"
          description="Browser-Tab: PNG, ICO oder SVG. Für die Anzeige in der App-Topzeile bitte PNG oder SVG (ICO nur im Tab, nicht in der Leiste)."
          previewUrl={faviconUrl}
          uploading={uploadingFavicon}
          onUpload={(file) => void handleUpload("favicon", file)}
          onRemove={() => void handleRemove("favicon")}
        />
      </div>

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
    </div>
  );
}
