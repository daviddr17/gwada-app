"use client";

import { ProfileIconDock } from "@/components/public/profile-icon-dock";
import type { ProfileAppDefinition, ProfileAppId } from "@/lib/public-profile/profile-app-config";
import { LazyMotion, domAnimation } from "framer-motion";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type ProfilePublicDockState = {
  apps: ProfileAppDefinition[];
  activeApp: ProfileAppId | null;
  isAppOpen: boolean;
  reduceMotion: boolean | null;
  onOpenApp: (appId: ProfileAppId, rect: DOMRect) => void;
  onSwitchModule: (appId: ProfileAppId) => void;
  onPreloadModule: (module: NonNullable<ProfileAppDefinition["module"]>) => void;
};

type ProfilePublicDockContextValue = {
  setDockState: (state: ProfilePublicDockState | null) => void;
};

const ProfilePublicDockContext =
  createContext<ProfilePublicDockContextValue | null>(null);

function ProfileIconDockPortal({
  apps,
  activeApp,
  isAppOpen,
  reduceMotion,
  onOpenApp,
  onSwitchModule,
  onPreloadModule,
}: ProfilePublicDockState) {
  return (
    <div className="pointer-events-auto">
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
    </div>
  );
}

function ProfilePublicDockLayer({ state }: { state: ProfilePublicDockState }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[9999] flex justify-center"
      style={{ WebkitTransform: "translate3d(0,0,0)", transform: "translate3d(0,0,0)" }}
      data-profile-public-dock
    >
      <ProfileIconDockPortal {...state} />
    </div>
  );
}

/** Dock per Portal auf document.body — umgeht Safari overflow-hidden-Fixed-Bug. */
export function ProfilePublicDockProvider({ children }: { children: ReactNode }) {
  const [dockState, setDockState] = useState<ProfilePublicDockState | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const value = useMemo(() => ({ setDockState }), []);

  return (
    <ProfilePublicDockContext.Provider value={value}>
      {children}
      {mounted && dockState
        ? createPortal(
            <LazyMotion features={domAnimation}>
              <ProfilePublicDockLayer state={dockState} />
            </LazyMotion>,
            document.body,
          )
        : null}
    </ProfilePublicDockContext.Provider>
  );
}

export function useProfilePublicDockBridge() {
  return useContext(ProfilePublicDockContext);
}
