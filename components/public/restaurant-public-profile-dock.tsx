"use client";

import { ProfileIconDock } from "@/components/public/profile-icon-dock";
import type { ProfileAppDefinition, ProfileAppId } from "@/lib/public-profile/profile-app-config";

export function RestaurantPublicProfileDock({
  apps,
  activeApp,
  isAppOpen,
  reduceMotion,
  onOpenApp,
  onSwitchModule,
  onPreloadModule,
}: {
  apps: ProfileAppDefinition[];
  activeApp: ProfileAppId | null;
  isAppOpen: boolean;
  reduceMotion: boolean | null;
  onOpenApp: (appId: ProfileAppId, rect: DOMRect) => void;
  onSwitchModule: (appId: ProfileAppId) => void;
  onPreloadModule: (module: NonNullable<ProfileAppDefinition["module"]>) => void;
}) {
  return (
    <ProfileIconDock
      apps={apps}
      activeAppId={isAppOpen ? activeApp : null}
      reduceMotion={reduceMotion}
      showIconTooltips
      tooltipAboveSheet={isAppOpen}
      onSelectApp={(appId, rect) => {
        if (isAppOpen) {
          onSwitchModule(appId);
          return;
        }
        if (rect) onOpenApp(appId, rect);
      }}
      onPreloadModule={onPreloadModule}
    />
  );
}
