"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DisplayContextResponse, DisplayModule } from "@/lib/display/display-types";
import { DISPLAY_MODULES } from "@/lib/display/display-types";
import { DisplayBrandMark } from "@/components/display/display-brand-mark";
import { DisplayLoggedInFooter } from "@/components/display/display-logged-in-footer";
import { DisplayRestaurantProfileHero } from "@/components/display/display-restaurant-profile-hero";
import { DisplayAccentRoot } from "@/components/display/display-accent-root";
import { DisplayLockOverlay } from "@/components/display/display-pin-pad";
import { DisplayPinPad } from "@/components/display/display-pin-pad";
import { DisplayModuleIcon } from "@/components/display/display-module-icon";
import { DisplayModuleShell } from "@/components/display/display-module-shell";
import { DisplayStaffLine } from "@/components/display/display-staff-line";
import { DisplayTimeModule } from "@/components/display/modules/display-time-module";
import { DisplayReservationsModule } from "@/components/display/modules/display-reservations-module";
import { DisplayInventoryModule } from "@/components/display/modules/display-inventory-module";
import { DisplayRecipesModule } from "@/components/display/modules/display-recipes-module";
import { Button } from "@/components/ui/button";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";
import { cn } from "@/lib/utils";
import { Loader2, MonitorOff } from "lucide-react";
import Link from "next/link";

export function DisplayScreen({ slug }: { slug: string }) {
  const [context, setContext] = useState<DisplayContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<DisplayModule | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockPinError, setLockPinError] = useState<string | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const refreshContext = useCallback(async () => {
    const res = await fetch("/api/display/context", { cache: "no-store" });
    const data = (await res.json()) as DisplayContextResponse;
    setContext(data);
    return data;
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await refreshContext();
      setLoading(false);
    })();
  }, [refreshContext]);

  useEffect(() => {
    if (!context?.session) {
      setActiveModule(null);
      return;
    }
    const mods = context.session.modules;
    if (mods.length === 0) {
      setActiveModule(null);
      return;
    }
    if (mods.length === 1 || !context.session.can_switch_modules) {
      setActiveModule(mods[0]!);
      return;
    }
    if (activeModule && !mods.includes(activeModule)) {
      setActiveModule(null);
    }
  }, [context?.session, activeModule]);

  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (!context?.display?.auto_lock_seconds || !context.session) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      void fetch("/api/display/pin", { method: "DELETE" });
      setLocked(true);
      setLockPinError(null);
    }, context.display.auto_lock_seconds * 1000);
  }, [context?.display?.auto_lock_seconds, context?.session]);

  useEffect(() => {
    resetIdleTimer();
    const onActivity = () => resetIdleTimer();
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  const submitPin = async (pinValue: string) => {
    setPinBusy(true);
    setPinError(null);
    setLockPinError(null);
    try {
      const res = await fetch("/api/display/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinValue }),
      });
      if (!res.ok) {
        const msg =
          pinValue.length === 4 ? "PIN falsch oder nicht vergeben." : "PIN falsch.";
        setPinError(msg);
        setLockPinError(msg);
        setPin("");
        return;
      }
      setPin("");
      const ctx = await refreshContext();
      const mods = ctx.session?.modules ?? [];
      setActiveModule(mods.length === 1 ? mods[0]! : null);
      setLocked(false);
    } finally {
      setPinBusy(false);
    }
  };

  const unlockWithPin = async (pinValue: string) => {
    await submitPin(pinValue);
  };

  const logout = async () => {
    await fetch("/api/display/pin", { method: "DELETE" });
    setActiveModule(null);
    setLocked(false);
    await refreshContext();
  };

  const heartbeat = useCallback(async () => {
    if (!context?.session || locked) return;
    await fetch("/api/display/pin", { method: "PATCH" });
  }, [context?.session, locked]);

  useEffect(() => {
    const id = setInterval(() => void heartbeat(), 30_000);
    return () => clearInterval(id);
  }, [heartbeat]);

  const restaurantAccent =
    normalizeHex(context?.restaurant?.accent_hex ?? "") ?? DEFAULT_ACCENT_HEX;

  let content: React.ReactNode;

  if (loading) {
    content = (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-10 animate-spin text-muted-foreground" />
      </div>
    );
  } else if (!context?.paired) {
    content = (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-8 text-center">
        <MonitorOff className="size-16 text-muted-foreground" />
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Kein Zugriff</h1>
          <p className="max-w-md text-muted-foreground">
            Dieses Gerät ist nicht mit einem Restaurant-Display gekoppelt.
            Bitte in den Einstellungen einen Kopplungscode erzeugen und das
            Tablet verbinden.
          </p>
        </div>
        <Link
          href="/display/pair"
          className={cn(
            "inline-flex h-12 items-center justify-center rounded-xl bg-accent px-6 text-lg font-medium text-accent-foreground hover:bg-accent/90",
          )}
        >
          Display koppeln
        </Link>
      </div>
    );
  } else if (context.restaurant && context.restaurant.slug !== slug) {
    content = (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-semibold">Falsches Restaurant</h1>
        <p className="text-muted-foreground">
          Dieses Tablet ist an „{context.restaurant.name}“ gekoppelt.
        </p>
        <Link
          href={`/display/${context.restaurant.slug}`}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent/90"
        >
          Weiter
        </Link>
      </div>
    );
  } else if (!context.session) {
    content = (
      <div className="flex min-h-dvh flex-col bg-background">
        <DisplayRestaurantProfileHero
          name={context.restaurant?.name ?? ""}
          avatarUrl={context.restaurant?.avatar_url}
          coverUrl={context.restaurant?.cover_url}
          accentHex={context.restaurant?.accent_hex}
          className="border-b border-border/50"
        />

        <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-8">
          <p className="text-lg font-medium text-foreground">PIN eingeben</p>
          <DisplayPinPad
            value={pin}
            onChange={setPin}
            disabled={pinBusy}
            onComplete={(p) => void submitPin(p)}
          />
          {pinError ? (
            <p className="text-sm text-destructive">{pinError}</p>
          ) : null}
        </main>

        <footer className="shrink-0 border-t border-border/30 px-4 py-3">
          <div className="flex items-center justify-center gap-2.5 text-muted-foreground">
            <DisplayBrandMark size="sm" className="!justify-start shrink-0" />
            {context.display?.name ? (
              <>
                <span aria-hidden className="text-border/80">
                  ·
                </span>
                <span className="text-xs">{context.display.name}</span>
              </>
            ) : null}
          </div>
        </footer>
      </div>
    );
  } else {
    const session = context.session;
    const modules = session.modules;
    const moduleMeta = DISPLAY_MODULES.filter((m) => modules.includes(m.id));

    if (!activeModule && modules.length > 1) {
      content = (
        <div className="flex min-h-dvh flex-col bg-background">
          <DisplayRestaurantProfileHero
            name={context.restaurant?.name ?? ""}
            avatarUrl={context.restaurant?.avatar_url}
            coverUrl={context.restaurant?.cover_url}
            accentHex={context.restaurant?.accent_hex}
            subtitle={
              <DisplayStaffLine
                staff={session.staff}
                suffix={context.display?.name ?? ""}
              />
            }
            className="border-b border-border/50"
          />
          <main className="grid flex-1 grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
            {moduleMeta.map((mod) => (
              <button
                key={mod.id}
                type="button"
                className={cn(
                  "flex min-h-44 flex-col items-center justify-center gap-3 rounded-3xl border border-border/50 bg-card p-6 text-center shadow-card transition-colors",
                  "hover:border-accent/40 hover:bg-accent/5 active:scale-[0.98]",
                )}
                onClick={() => setActiveModule(mod.id)}
              >
                <span className="flex size-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                  <DisplayModuleIcon module={mod.id} className="size-7" />
                </span>
                <span className="text-2xl font-semibold">{mod.label}</span>
                <span className="text-sm text-muted-foreground">
                  {mod.description}
                </span>
              </button>
            ))}
          </main>
          <DisplayLoggedInFooter onLogout={() => void logout()} />
        </div>
      );
    } else {
      const currentModule = activeModule ?? modules[0]!;

      content = (
        <div className="flex min-h-dvh flex-col">
          <DisplayLockOverlay
            open={locked}
            onUnlock={(p) => void unlockWithPin(p)}
            busy={pinBusy}
            error={lockPinError}
          />
          <DisplayModuleShell
            restaurantName={context.restaurant?.name ?? ""}
            restaurantAvatarUrl={context.restaurant?.avatar_url ?? null}
            displayName={context.display?.name ?? ""}
            staff={session.staff}
            modules={moduleMeta}
            activeModule={currentModule}
            canSwitch={session.can_switch_modules && modules.length > 1}
            onModuleChange={setActiveModule}
            onLogout={() => void logout()}
          >
            {currentModule === "time" ? (
              <DisplayTimeModule
                initial={context.time_session}
                onChanged={() => void refreshContext()}
              />
            ) : null}
            {currentModule === "reservations" ? (
              <DisplayReservationsModule />
            ) : null}
            {currentModule === "recipes" ? (
              <DisplayRecipesModule />
            ) : null}
            {currentModule === "inventory" ? <DisplayInventoryModule /> : null}
          </DisplayModuleShell>
        </div>
      );
    }
  }

  return (
    <DisplayAccentRoot accentHex={restaurantAccent}>{content}</DisplayAccentRoot>
  );
}
