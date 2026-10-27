"use client";

import { Check } from "lucide-react";
import { toast } from "sonner";
import { NewsPlatformIcon } from "@/components/news/news-platform-icon";
import { SearchableSelect } from "@/components/ui/combobox";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { DrawerFilterFooter } from "@/components/ui/drawer-filter-footer";
import {
  DrawerFilterField,
  DrawerFilterHeader,
  DrawerFilterZone,
} from "@/components/ui/drawer-filter-sheet";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import {
  SOCIAL_TONE_LABELS,
  SOCIAL_TONES,
  type SocialTone,
} from "@/lib/social/social-brand-kit";
import {
  SOCIAL_MEDIA_FORMAT_IDS,
  SOCIAL_MEDIA_FORMATS,
  type SocialMediaFormatId,
} from "@/lib/social/social-media-formats";
import { allSocialPublishPlatformOptions } from "@/lib/social/social-publish-platforms";
import type { NewsPlatform } from "@/lib/constants/news-platforms";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { cn } from "@/lib/utils";

const selectClassName = appSelectTriggerAccentCn(staffDrawerFieldClassName);

const DEFAULT_PLATFORMS: NewsPlatform[] = ["instagram", "facebook"];

export function SocialAutopilotOptionsDrawer({
  open,
  onOpenChange,
  title = "Kanäle & Stil",
  tone,
  onToneChange,
  platforms,
  onPlatformsChange,
  format,
  onFormatChange,
  showTone = true,
  defaults,
  doneLabel = "Fertig",
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  tone: SocialTone;
  onToneChange: (tone: SocialTone) => void;
  platforms: NewsPlatform[];
  onPlatformsChange: (platforms: NewsPlatform[]) => void;
  format: SocialMediaFormatId;
  onFormatChange: (format: SocialMediaFormatId) => void;
  /** Bei Freigabe-Edit oft nur Kanäle/Format — Ton war Session-weit. */
  showTone?: boolean;
  defaults?: {
    tone: SocialTone;
    platforms: NewsPlatform[];
    format: SocialMediaFormatId;
  };
  doneLabel?: string;
  /** Default: Sheet schließen. Z. B. „Generieren“ startet Create. */
  onDone?: () => void;
}) {
  const platformOptions = allSocialPublishPlatformOptions();
  const toneOptions = SOCIAL_TONES.map((t) => ({
    value: t,
    label: SOCIAL_TONE_LABELS[t],
  }));
  const formatOptions = SOCIAL_MEDIA_FORMAT_IDS.filter(
    (id) => id !== "story_9x16",
  ).map((id) => ({
    value: id,
    label: `${SOCIAL_MEDIA_FORMATS[id].ratioLabel} · ${SOCIAL_MEDIA_FORMATS[id].label}`,
  }));

  const resetDefaults = defaults ?? {
    tone: "warm" as SocialTone,
    platforms: DEFAULT_PLATFORMS,
    format: "square_1x1" as SocialMediaFormatId,
  };

  const togglePlatform = (p: NewsPlatform) => {
    if (platforms.includes(p)) {
      if (platforms.length <= 1) {
        toast.message("Mindestens ein Kanal bleibt aktiv");
        return;
      }
      onPlatformsChange(platforms.filter((x) => x !== p));
      return;
    }
    onPlatformsChange([...platforms, p]);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("template")}>
        <DrawerFilterHeader title={title} />
        <div className={drawerScrollAreaClassName(6)}>
          <DrawerFilterZone showLabel={false}>
            {showTone ? (
              <DrawerFilterField label="Ton">
                <SearchableSelect
                  value={tone}
                  onValueChange={(v) => {
                    if (typeof v === "string" && v in SOCIAL_TONE_LABELS) {
                      onToneChange(v as SocialTone);
                    }
                  }}
                  options={toneOptions}
                  placeholder="Ton wählen"
                  className={selectClassName}
                  side="top"
                  aria-label="Caption-Ton"
                />
              </DrawerFilterField>
            ) : null}

            <DrawerFilterField label="Kanäle">
              <p className="mb-2 text-xs text-muted-foreground">
                Mindestens einer — tippe zum An-/Abwählen.
              </p>
              <ul className="space-y-2">
                {platformOptions.map((opt) => {
                  const on = platforms.includes(opt.value);
                  return (
                    <li key={opt.value}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => togglePlatform(opt.value)}
                        className={cn(
                          "flex h-12 w-full items-center justify-between gap-3 rounded-xl border px-3.5 text-left text-sm font-medium touch-manipulation transition-colors",
                          on
                            ? "border-accent/50 bg-accent/10 text-foreground"
                            : "border-border/60 bg-card text-muted-foreground",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <NewsPlatformIcon
                            platform={opt.value}
                            className="size-4"
                          />
                          <span className="truncate">{opt.label}</span>
                        </span>
                        {on ? (
                          <Check className="size-4 shrink-0 text-foreground" />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </DrawerFilterField>

            <DrawerFilterField label="Format">
              <SearchableSelect
                value={format}
                onValueChange={(v) => {
                  if (
                    typeof v === "string" &&
                    SOCIAL_MEDIA_FORMAT_IDS.includes(v as SocialMediaFormatId)
                  ) {
                    onFormatChange(v as SocialMediaFormatId);
                  }
                }}
                options={formatOptions}
                placeholder="Format wählen"
                className={selectClassName}
                side="top"
                aria-label="Post-Format"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Stories (9:16) werden beim Publish automatisch zugeschnitten.
              </p>
            </DrawerFilterField>
          </DrawerFilterZone>
        </div>
        <DrawerFilterFooter
          doneLabel={doneLabel}
          onReset={() => {
            onToneChange(resetDefaults.tone);
            onPlatformsChange([...resetDefaults.platforms]);
            onFormatChange(resetDefaults.format);
            toast.success("Optionen zurückgesetzt");
          }}
          onDone={() => {
            if (onDone) onDone();
            else onOpenChange(false);
          }}
        />
      </DrawerContent>
    </Drawer>
  );
}
