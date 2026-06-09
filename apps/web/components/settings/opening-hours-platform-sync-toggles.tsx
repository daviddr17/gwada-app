"use client";

import type { ReactNode } from "react";
import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

function PlatformSyncToggle({
  platform,
  checked,
  onCheckedChange,
  icon,
}: {
  platform: "Google" | "Facebook";
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/50 bg-card">
        {icon}
      </span>
      <Switch
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        size="sm"
        aria-label={`${platform}: Öffnungszeiten beim Speichern übertragen`}
      />
    </div>
  );
}

export function OpeningHoursPlatformSyncToggles({
  googleConnected,
  facebookConnected,
  syncGoogle,
  syncFacebook,
  onSyncGoogleChange,
  onSyncFacebookChange,
  className,
}: {
  googleConnected: boolean;
  facebookConnected: boolean;
  syncGoogle: boolean;
  syncFacebook: boolean;
  onSyncGoogleChange: (checked: boolean) => void;
  onSyncFacebookChange: (checked: boolean) => void;
  className?: string;
}) {
  if (!googleConnected && !facebookConnected) return null;

  return (
    <div
      className={cn("flex flex-wrap items-center gap-3 sm:gap-4", className)}
      role="group"
      aria-label="Plattformen beim Speichern übertragen"
    >
      {googleConnected ? (
        <PlatformSyncToggle
          platform="Google"
          checked={syncGoogle}
          onCheckedChange={onSyncGoogleChange}
          icon={<GoogleGlyph className="size-4 shrink-0" aria-hidden />}
        />
      ) : null}
      {facebookConnected ? (
        <PlatformSyncToggle
          platform="Facebook"
          checked={syncFacebook}
          onCheckedChange={onSyncFacebookChange}
          icon={<FacebookGlyph className="size-4 shrink-0" aria-hidden />}
        />
      ) : null}
    </div>
  );
}
