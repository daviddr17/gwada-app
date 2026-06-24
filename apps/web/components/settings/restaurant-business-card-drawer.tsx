"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RestaurantBusinessCardPreview } from "@/components/settings/restaurant-business-card-preview";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { DrawerFormBody, DrawerFormSection } from "@/components/ui/drawer-form-section";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  buildBusinessCardContent,
  businessCardPdfFileName,
  DEFAULT_BUSINESS_CARD_OPTIONS,
  type BusinessCardOptions,
} from "@/lib/restaurant/business-card-layout";
import { generateBusinessCardPdf } from "@/lib/restaurant/generate-business-card-pdf";
import { resolveRestaurantProfileImageSignedUrl } from "@/lib/restaurant/restaurant-profile-image";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { RestaurantProfile } from "@/lib/types/restaurant";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";

const TOGGLE_ITEMS: Array<{
  key: keyof BusinessCardOptions;
  label: string;
  description: string;
}> = [
  {
    key: "showCover",
    label: "Titelbild",
    description: "Oberer Bildstreifen — sonst Verlauf in Akzentfarbe.",
  },
  {
    key: "showLogo",
    label: "Logo",
    description: "Profilbild über dem Inhalt.",
  },
  {
    key: "showAddress",
    label: "Anschrift",
    description: "Straße, PLZ, Ort und Land.",
  },
  {
    key: "showPhone",
    label: "Telefon",
    description: "Rufnummer aus den Stammdaten.",
  },
  {
    key: "showWebsite",
    label: "Website",
    description: "Internetadresse als Kurzlink.",
  },
  {
    key: "showOpeningHours",
    label: "Öffnungszeiten",
    description: "Wochenplan aus den Öffnungszeiten-Einstellungen.",
  },
  {
    key: "showGwadaFooter",
    label: "„Erstellt mit Gwada“",
    description: "Kleiner Hinweis am unteren Kartenrand.",
  },
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
  const [options, setOptions] = useState<BusinessCardOptions>(
    DEFAULT_BUSINESS_CARD_OPTIONS,
  );
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOptions(DEFAULT_BUSINESS_CARD_OPTIONS);
  }, [open, profile.id]);

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

  const content = useMemo(
    () => buildBusinessCardContent(profile, options),
    [profile, options],
  );

  const setOption = useCallback(
    (key: keyof BusinessCardOptions, value: boolean) => {
      setOptions((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await generateBusinessCardPdf({
        content,
        options,
        accentHex,
        coverUrl: options.showCover ? coverUrl : null,
        logoUrl: options.showLogo ? logoUrl : null,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = businessCardPdfFileName(profile.slug);
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Visitenkarte heruntergeladen.");
    } catch {
      toast.error("PDF konnte nicht erstellt werden.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("wide")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Visitenkarte erstellen
          </DrawerTitle>
          <DrawerDescription className="text-sm leading-relaxed">
            Inhalte wählen — die Vorschau aktualisiert sich sofort. PDF in
            Akzentfarbe mit Logo und Titelbild.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerFormBody>
        <div className={drawerScrollAreaClassName(6)}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:items-start">
            <DrawerFormSection bleed={false} title="Inhalte" className="space-y-1">
              {TOGGLE_ITEMS.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/15 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <Label
                      htmlFor={`bc-${item.key}`}
                      className="text-sm font-medium"
                    >
                      {item.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <Switch
                    id={`bc-${item.key}`}
                    checked={options[item.key]}
                    onCheckedChange={(checked) =>
                      setOption(item.key, checked === true)
                    }
                  />
                </div>
              ))}
            </DrawerFormSection>

            <div className="flex flex-col items-center gap-3">
              <p className="w-full text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Live-Vorschau
              </p>
              <RestaurantBusinessCardPreview
                content={content}
                options={options}
                accentHex={accentHex}
                coverUrl={coverUrl}
                logoUrl={logoUrl}
              />
              <p className="max-w-xs text-center text-xs text-muted-foreground">
                Format 90 × 128 mm — druckfertiges PDF mit eingebetteten Farben.
              </p>
            </div>
          </div>
        </div>

        <DrawerFormFooter
          contentPadding={6}
          onCancel={() => onOpenChange(false)}
          cancelLabel="Schließen"
          showSubmit
          submitType="button"
          submitLabel="PDF herunterladen"
          submitPending={downloading}
          onSubmit={() => void handleDownload()}
          submitDisabled={!content.name.trim()}
        />
        </DrawerFormBody>
      </DrawerContent>
    </Drawer>
  );
}
