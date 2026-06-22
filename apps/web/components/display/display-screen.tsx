"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { DisplayContextResponse, DisplayModule } from "@/lib/display/display-types";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { DISPLAY_MODULES } from "@/lib/display/display-types";
import { DisplayContextFooter } from "@/components/display/display-context-footer";
import { DisplayChromeHeader } from "@/components/display/display-chrome-header";
import { DisplayAccentRoot } from "@/components/display/display-accent-root";
import { DisplaySignOutOverlay } from "@/components/display/display-sign-out-overlay";
import { DisplayLockOverlay } from "@/components/display/display-pin-pad";
import { DisplayPinPad } from "@/components/display/display-pin-pad";
import { DisplayModuleIcon } from "@/components/display/display-module-icon";
import { DisplayModuleShell } from "@/components/display/display-module-shell";
import { DisplayStaffLine } from "@/components/display/display-staff-line";
import { DisplayStaffTodoBadge } from "@/components/display/display-staff-todo-badge";
import { DisplayTimeModule } from "@/components/display/modules/display-time-module";
import {
  DisplayTimeTodoPopup,
  useDisplayTimeTodoGate,
} from "@/components/display/modules/display-time-todo-popup";
import { DisplayReservationsModule } from "@/components/display/modules/display-reservations-module";
import { DisplayInventoryModule } from "@/components/display/modules/display-inventory-module";
import { DisplayRecipesModule } from "@/components/display/modules/display-recipes-module";
import { Button } from "@/components/ui/button";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";
import { cn } from "@/lib/utils";
import { Loader2, MonitorOff } from "lucide-react";
import Link from "next/link";
import {
  readDisplayDeviceCredential,
} from "@/lib/display/display-device-storage";
import { syncDisplayReservationsLiveAfterPin } from "@/lib/display/display-reservations-live-events";
import { syncDisplayTodosLiveAfterPin } from "@/lib/display/display-todos-live-events";
import { submitDisplayPin } from "@/lib/display/submit-display-pin";
import {
  displayChromeMainClassName,
  displayChromeContentWrapClassName,
  displayChromeShellClassName,
} from "@/lib/ui/display-chrome";
import { useDisplayReservationsLive } from "@/lib/hooks/use-display-reservations-live";
import { useDisplayTodoBadgeCount } from "@/lib/hooks/use-display-todo-badge-count";
import { useDisplayTodosLive } from "@/lib/hooks/use-display-todos-live";
import {
  DISPLAY_PIN_REVEAL_MS,
  DISPLAY_PIN_REVEAL_REDUCED_MS,
  MOTION_EASE_OUT,
} from "@/lib/ui/motion-presets";

export function DisplayScreen({ slug }: { slug: string }) {
  const reduceMotion = useReducedMotion() ?? false;
  const pinRevealMs = reduceMotion ? DISPLAY_PIN_REVEAL_REDUCED_MS : DISPLAY_PIN_REVEAL_MS;
  const [context, setContext] = useState<DisplayContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinUnlocking, setPinUnlocking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<DisplayModule | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockPinError, setLockPinError] = useState<string | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const pendingPinTodoGateRef = useRef(false);
  const { preparePinLoginGate, popupProps: pinTodoPopupProps } =
    useDisplayTimeTodoGate();

  const refreshContext = useCallback(async () => {
    const res = await fetch("/api/display/context", { cache: "no-store" });
    const data = (await res.json()) as DisplayContextResponse;
    setContext(data);
    return data;
  }, []);

  const tryRestoreDeviceCookie = useCallback(async () => {
    const cred = readDisplayDeviceCredential();
    if (!cred) return false;
    const res = await fetch("/api/display/device/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_id: cred.displayId,
        installation_id: cred.installationId,
        device_token: cred.token,
      }),
    });
    return res.ok;
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      let data = await refreshContext();
      if (!data.paired) {
        const restored = await tryRestoreDeviceCookie();
        if (restored) {
          data = await refreshContext();
        }
      }
      setLoading(false);
    })();
  }, [refreshContext, tryRestoreDeviceCookie]);

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

  const reservationsLiveEnabled = Boolean(
    context?.session &&
      !locked &&
      context.session.modules.includes("reservations"),
  );
  useDisplayReservationsLive(reservationsLiveEnabled);

  const todosLiveEnabled = Boolean(context?.session && !locked);
  useDisplayTodosLive(todosLiveEnabled);

  const { count: todoBadgeCount, urgency: todoBadgeUrgency, refresh: refreshTodoBadge } =
    useDisplayTodoBadgeCount(todosLiveEnabled);

  useEffect(() => {
    if (!pendingPinTodoGateRef.current || !context?.session) return;
    pendingPinTodoGateRef.current = false;
    void preparePinLoginGate().then(() => {
      void refreshTodoBadge();
    });
  }, [context?.session, preparePinLoginGate, refreshTodoBadge]);

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
      const result = await submitDisplayPin(pinValue);
      if (!result.ok) {
        setPinError(result.message);
        setLockPinError(result.message);
        setPin("");
        return;
      }
      setPin("");
      setPinUnlocking(true);
      pendingPinTodoGateRef.current = true;
      const ctx = result.context;
      const mods = ctx.session?.modules ?? [];
      await new Promise((resolve) => {
        window.setTimeout(resolve, reduceMotion ? 80 : 300);
      });
      setContext(ctx);
      setActiveModule(mods.length === 1 ? mods[0]! : null);
      setLocked(false);
      setPinUnlocking(false);
      window.setTimeout(() => {
        syncDisplayTodosLiveAfterPin();
        if (mods.includes("reservations")) {
          syncDisplayReservationsLiveAfterPin();
        }
      }, 0);
    } finally {
      setPinBusy(false);
    }
  };

  const unlockWithPin = async (pinValue: string) => {
    await submitPin(pinValue);
  };

  const logout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setLockPinError(null);
    try {
      await fetch("/api/display/pin", { method: "DELETE" });
      setActiveModule(null);
      setLocked(false);
      await new Promise((resolve) => {
        window.setTimeout(resolve, pinRevealMs);
      });
      await refreshContext();
    } finally {
      setSigningOut(false);
    }
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
  let contentKey = "shell";

  if (loading) {
    content = (
      <div className={displayChromeShellClassName}>
        <DisplayChromeHeader />
        <main
          className={cn(
            displayChromeMainClassName,
            "flex items-center justify-center",
          )}
        >
          <Loader2 className="size-10 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  } else if (!context?.paired) {
    const pairingHint = (() => {
      switch (context?.pairing_status) {
        case "display_inactive":
          return {
            title: "Display deaktiviert",
            body: "Dieses Display ist in den Einstellungen als inaktiv markiert. Aktiviere es dort wieder — eine erneute Kopplung ist dafür nicht nötig, sofern das Tablet schon gekoppelt war.",
            showPairLink: false,
          };
        case "token_revoked":
          return {
            title: "Kopplung ungültig",
            body: "Die Kopplung wurde ersetzt (z. B. „Neu koppeln“ oder anderes Tablet mit demselben Code). Bitte in den Einstellungen einen neuen Kopplungscode erzeugen und hier verbinden.",
            showPairLink: true,
          };
        case "not_paired_server":
          return {
            title: "Noch nicht gekoppelt",
            body: "Für dieses Display wurde noch kein Tablet verbunden. In den Einstellungen „Koppeln“ wählen, QR-Code oder Code am Tablet eingeben.",
            showPairLink: true,
          };
        case "display_missing":
          return {
            title: "Display nicht gefunden",
            body: "Dieses Display existiert nicht mehr. Bitte in den Einstellungen ein neues Display anlegen und koppeln.",
            showPairLink: true,
          };
        case "no_device_cookie":
        default:
          return {
            title: "Tablet nicht gekoppelt",
            body: "Der Browser-Cookie fehlt. Wenn dieses Tablet schon einmal gekoppelt war, wird die Kopplung automatisch aus dem Gerätespeicher wiederhergestellt — sonst in den Einstellungen einen Code holen. (MAC-Adressen sind im Browser aus Datenschutzgründen nicht verfügbar; stattdessen eine stabile Geräte-ID pro Tablet.)",
            showPairLink: true,
          };
      }
    })();

    content = (
      <div className={displayChromeShellClassName}>
        <DisplayChromeHeader />
        <main
          className={cn(
            displayChromeMainClassName,
            "flex flex-col items-center justify-center gap-6 p-8 text-center",
          )}
        >
          <MonitorOff className="size-16 text-muted-foreground" />
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold">{pairingHint.title}</h1>
            <p className="max-w-md text-muted-foreground">{pairingHint.body}</p>
          </div>
          {pairingHint.showPairLink ? (
            <Link
              href="/display/pair"
              className={cn(
                "inline-flex h-12 items-center justify-center px-6 text-lg font-medium",
                brandActionButtonRoundedClassName,
              )}
            >
              Display koppeln
            </Link>
          ) : null}
        </main>
      </div>
    );
  } else if (context.restaurant && context.restaurant.slug !== slug) {
    content = (
      <div className={displayChromeShellClassName}>
        <DisplayChromeHeader />
        <main
          className={cn(
            displayChromeMainClassName,
            "flex flex-col items-center justify-center gap-4 p-8 text-center",
          )}
        >
          <h1 className="text-2xl font-semibold">Falsches Restaurant</h1>
          <p className="text-muted-foreground">
            Dieses Tablet ist an „{context.restaurant.name}“ gekoppelt.
          </p>
          <Link
            href={`/display/${context.restaurant.slug}`}
            className={cn(
              "inline-flex h-10 items-center justify-center px-4 text-sm font-medium",
              brandActionButtonRoundedClassName,
            )}
          >
            Weiter
          </Link>
        </main>
      </div>
    );
  } else if (!context.session) {
    contentKey = "pin";
    content = (
      <div className={displayChromeShellClassName}>
        <DisplayChromeHeader>
          <span className="text-sm font-medium text-foreground">PIN eingeben</span>
        </DisplayChromeHeader>

        <div className={displayChromeContentWrapClassName}>
          <AnimatePresence>
            {pinUnlocking ? (
              <motion.div
                key="pin-unlock"
                className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/65 backdrop-blur-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: reduceMotion ? 0.1 : 0.32,
                  ease: MOTION_EASE_OUT,
                }}
              >
                <motion.div
                  className="flex size-24 items-center justify-center rounded-full bg-accent/15 ring-2 ring-accent/40"
                  initial={{ scale: reduceMotion ? 1 : 0.72, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={
                    reduceMotion
                      ? { duration: 0.1 }
                      : { type: "spring", stiffness: 420, damping: 26 }
                  }
                >
                  <motion.span
                    className="size-4 rounded-full bg-accent"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={
                      reduceMotion
                        ? { duration: 0.1 }
                        : { type: "spring", stiffness: 500, damping: 22, delay: 0.06 }
                    }
                  />
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <main
            className={cn(
              displayChromeMainClassName,
              "flex flex-col items-center justify-center gap-5 px-6 py-6",
            )}
          >
            <DisplayPinPad
              value={pin}
              onChange={setPin}
              disabled={pinBusy || pinUnlocking}
              busy={pinBusy}
              onComplete={(p) => void submitPin(p)}
            />
            {pinError ? (
              <p className="text-sm text-destructive">{pinError}</p>
            ) : null}
          </main>
        </div>

        <DisplayContextFooter
          restaurantName={context.restaurant?.name ?? ""}
          restaurantAvatarUrl={context.restaurant?.avatar_url}
          displayName={context.display?.name}
        />
      </div>
    );
  } else {
    contentKey = "session";
    const session = context.session;
    const modules = session.modules;
    const moduleMeta = DISPLAY_MODULES.filter((m) => modules.includes(m.id));

    if (!activeModule && modules.length > 1) {
      content = (
        <div className={displayChromeShellClassName}>
          <DisplayChromeHeader>
            <DisplayStaffLine staff={session.staff} className="min-w-0 text-sm" />
          </DisplayChromeHeader>
          <div className={displayChromeContentWrapClassName}>
            <DisplayLockOverlay
              open={locked}
              placement="content"
              onUnlock={(p) => void unlockWithPin(p)}
              busy={pinBusy}
              error={lockPinError}
            />
            <main
              className={cn(
                displayChromeMainClassName,
                "grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3",
              )}
            >
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
          </div>
          <DisplayContextFooter
            restaurantName={context.restaurant?.name ?? ""}
            restaurantAvatarUrl={context.restaurant?.avatar_url}
            displayName={context.display?.name}
            showLogout={!locked}
            onLogout={() => void logout()}
            todoBadge={
              <DisplayStaffTodoBadge
                count={todoBadgeCount}
                urgency={todoBadgeUrgency}
                onChanged={() => void refreshTodoBadge()}
              />
            }
          />
        </div>
      );
    } else {
      const currentModule = activeModule ?? modules[0]!;

      content = (
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
            todoBadgeCount={todoBadgeCount}
            todoBadgeUrgency={todoBadgeUrgency}
            onTodoChanged={() => {
              void refreshTodoBadge();
              void refreshContext();
            }}
            locked={locked}
            onUnlock={(p) => void unlockWithPin(p)}
            lockBusy={pinBusy}
            lockError={lockPinError}
          >
            {currentModule === "time" ? (
              <DisplayTimeModule
                initial={context.time_session}
                onChanged={() => {
                  void refreshContext();
                  void refreshTodoBadge();
                }}
                onClockOutSuccess={() => void logout()}
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
      );
    }
  }

  return (
    <DisplayAccentRoot accentHex={restaurantAccent}>
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={contentKey}
          className={contentKey === "pin" || contentKey === "session" ? "min-h-dvh" : undefined}
          initial={
            contentKey === "session"
              ? { opacity: 0 }
              : false
          }
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: pinRevealMs / 1000,
            ease: MOTION_EASE_OUT,
          }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
      <DisplaySignOutOverlay open={signingOut} />
      <DisplayTimeTodoPopup {...pinTodoPopupProps} />
    </DisplayAccentRoot>
  );
}
