"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { DisplayContextResponse, DisplayModule } from "@/lib/display/display-types";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { DISPLAY_MODULES } from "@/lib/display/display-types";
import { DisplayContextFooter } from "@/components/display/display-context-footer";
import { DisplayChromeHeader } from "@/components/display/display-chrome-header";
import { DisplayAccentRoot } from "@/components/display/display-accent-root";
import { DisplayRestaurantTimezoneProvider } from "@/components/display/display-restaurant-timezone-provider";
import { DisplayBrandedBackground } from "@/components/display/display-branded-background";
import { DisplayCelebrationOverlay, type DisplayCelebrationVariant } from "@/components/display/display-celebration-overlay";
import { DisplayLockOverlay } from "@/components/display/display-pin-pad";
import { DisplayPinPad } from "@/components/display/display-pin-pad";
import { DisplayPinStandbyScene } from "@/components/display/display-pin-standby";
import { DisplayModuleIcon } from "@/components/display/display-module-icon";
import { DisplayModuleShell } from "@/components/display/display-module-shell";
import { DisplayStaffLine } from "@/components/display/display-staff-line";
import { DisplayTimeStatusSuffix } from "@/components/display/display-time-status-suffix";
import { DisplayStaffTodoBadge } from "@/components/display/display-staff-todo-badge";
import { DisplayTimeModule } from "@/components/display/modules/display-time-module";
import {
  acknowledgeDisplayTimeRequestResolutions,
  fetchDisplayTimeRequestResolutions,
  type DisplayTimeRequestResolution,
} from "@/components/display/modules/display-time-request-sheet";
import {
  DisplayTimeTodoPopup,
  useDisplayShiftGates,
} from "@/components/display/modules/display-shift-gates";
import { DisplayReservationsModule } from "@/components/display/modules/display-reservations-module";
import { DisplayInventoryModule } from "@/components/display/modules/display-inventory-module";
import { DisplayComplianceModule } from "@/components/display/modules/display-compliance-module";
import { DisplayRecipesModule } from "@/components/display/modules/display-recipes-module";
import { Button } from "@/components/ui/button";
import { DEFAULT_RESTAURANT_TIMEZONE } from "@/lib/restaurant/restaurant-timezone";
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
import {
  getAutoDisplayModule,
  resolveDisplayActiveModule,
  shouldShowDisplayModulePicker,
} from "@/lib/display/display-module-navigation";
import { submitDisplayPin } from "@/lib/display/submit-display-pin";
import {
  DISPLAY_SESSION_EXPIRED_EVENT,
  displaySessionAuthErrorMessage,
  handleDisplaySessionAuthFailure,
} from "@/lib/display/display-session-client";
import { STAFF_WORK_ENTRY_LABELS } from "@/lib/types/staff";
import {
  displayChromeMainClassName,
  displayChromeContentWrapClassName,
  displayChromeShellClassName,
} from "@/lib/ui/display-chrome";
import { toast } from "sonner";
import { useDisplayInventoryLive } from "@/lib/hooks/use-display-inventory-live";
import { useDisplayRecipesLive } from "@/lib/hooks/use-display-recipes-live";
import { useDisplayReservationsLive } from "@/lib/hooks/use-display-reservations-live";
import { useDisplayTimeLive } from "@/lib/hooks/use-display-time-live";
import { useDisplayTimeSession } from "@/lib/hooks/use-display-time-session";
import { useDisplayTodoBadgeCount } from "@/lib/hooks/use-display-todo-badge-count";
import { useDisplayTodosLive } from "@/lib/hooks/use-display-todos-live";
import {
  DISPLAY_CELEBRATION_EXIT_MS,
  DISPLAY_CELEBRATION_EXIT_REDUCED_MS,
  MOTION_EASE_OUT,
} from "@/lib/ui/motion-presets";

export function DisplayScreen({ slug }: { slug: string }) {
  const reduceMotion = useReducedMotion() ?? false;
  const contentRevealMs = reduceMotion
    ? DISPLAY_CELEBRATION_EXIT_REDUCED_MS
    : DISPLAY_CELEBRATION_EXIT_MS;
  const [context, setContext] = useState<DisplayContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [screenCelebration, setScreenCelebration] =
    useState<DisplayCelebrationVariant | null>(null);
  const [screenCelebrationSublabel, setScreenCelebrationSublabel] = useState<
    string | undefined
  >();
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinRejectNonce, setPinRejectNonce] = useState(0);
  const [activeModule, setActiveModule] = useState<DisplayModule | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockPinError, setLockPinError] = useState<string | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const pinLoginGatePreparingRef = useRef(false);
  const sessionRestoreGatePreparedRef = useRef(false);
  const pendingPinSessionRef = useRef<{
    ctx: DisplayContextResponse;
    mods: DisplayModule[];
  } | null>(null);
  const pinLoginGatePendingRef = useRef(false);
  const timeRequestResolutionCheckedStaffRef = useRef<string | null>(null);
  const pendingTimeRequestResolutionRef = useRef<DisplayTimeRequestResolution | null>(
    null,
  );
  const { preparePinLoginGate, prepareAndGate, todoPopupProps } =
    useDisplayShiftGates();

  const restaurantTimezone =
    context?.restaurant?.timezone ?? DEFAULT_RESTAURANT_TIMEZONE;

  const showTimeRequestResolutionCelebration = useCallback(
    (resolution: DisplayTimeRequestResolution) => {
      const fmt = new Intl.DateTimeFormat("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: restaurantTimezone,
      });
      const from = fmt.format(new Date(resolution.requested_starts_at));
      const to = fmt.format(new Date(resolution.requested_ends_at));
      setScreenCelebrationSublabel(
        `${STAFF_WORK_ENTRY_LABELS[resolution.entry_type]} · ${from}–${to}`,
      );
      setScreenCelebration(
        resolution.status === "approved"
          ? "time_request_accepted"
          : "time_request_declined",
      );
    },
    [restaurantTimezone],
  );

  const maybeShowTimeRequestResolution = useCallback(async () => {
    const staffId = context?.session?.staff.id;
    if (!staffId) return;
    if (timeRequestResolutionCheckedStaffRef.current === staffId) return;
    if (screenCelebration || todoPopupProps.open || todoPopupProps.gateCelebration) {
      return;
    }

    timeRequestResolutionCheckedStaffRef.current = staffId;
    const resolutions = await fetchDisplayTimeRequestResolutions();
    const first = resolutions[0];
    if (!first) return;

    pendingTimeRequestResolutionRef.current = first;
    showTimeRequestResolutionCelebration(first);
  }, [
    context?.session?.staff.id,
    screenCelebration,
    showTimeRequestResolutionCelebration,
    todoPopupProps.gateCelebration,
    todoPopupProps.open,
  ]);

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
    const session = context.session;
    if (session.modules.length === 0) {
      setActiveModule(null);
      return;
    }
    const auto = getAutoDisplayModule(session);
    if (auto) {
      setActiveModule(auto);
      return;
    }
    if (activeModule && !session.modules.includes(activeModule)) {
      setActiveModule(null);
    }
  }, [context?.session, activeModule]);

  const syncLiveAfterPin = useCallback((mods: DisplayModule[]) => {
    window.setTimeout(() => {
      syncDisplayTodosLiveAfterPin();
      if (mods.includes("reservations")) {
        syncDisplayReservationsLiveAfterPin();
      }
    }, 0);
  }, []);

  const finishPinLogin = useCallback(
    (ctx: DisplayContextResponse) => {
      const session = ctx.session;
      if (!session) return;

      setContext(ctx);
      setActiveModule(getAutoDisplayModule(session));
      setLocked(false);
      sessionRestoreGatePreparedRef.current = true;
      syncLiveAfterPin(session.modules);
    },
    [syncLiveAfterPin],
  );

  const reservationsLiveEnabled = Boolean(
    context?.session &&
      !locked &&
      context.session.modules.includes("reservations"),
  );
  useDisplayReservationsLive(reservationsLiveEnabled);

  const inventoryLiveEnabled = Boolean(
    context?.session &&
      !locked &&
      context.session.modules.includes("inventory"),
  );
  useDisplayInventoryLive(inventoryLiveEnabled);

  const recipesLiveEnabled = Boolean(
    context?.session &&
      !locked &&
      context.session.modules.includes("recipes"),
  );
  useDisplayRecipesLive(recipesLiveEnabled);

  const timeLiveEnabled = Boolean(
    context?.session &&
      !locked &&
      context.session.modules.includes("time"),
  );
  useDisplayTimeLive(timeLiveEnabled);

  const todosLiveEnabled = Boolean(context?.session && !locked);
  useDisplayTodosLive(todosLiveEnabled);

  const { count: todoBadgeCount, urgency: todoBadgeUrgency, refresh: refreshTodoBadge } =
    useDisplayTodoBadgeCount(todosLiveEnabled);

  const runPinLoginGate = useCallback(() => {
    pinLoginGatePreparingRef.current = true;
    void preparePinLoginGate()
      .finally(() => {
        pinLoginGatePreparingRef.current = false;
        void refreshTodoBadge();
        void maybeShowTimeRequestResolution();
      });
  }, [preparePinLoginGate, refreshTodoBadge, maybeShowTimeRequestResolution]);

  const sessionActive = Boolean(context?.session);
  const { state: timeSession, refresh: refreshTimeSession, patch: patchTimeSession } =
    useDisplayTimeSession(sessionActive, context?.time_session ?? null);
  const timeStatusSuffix = sessionActive ? (
    <DisplayTimeStatusSuffix status={timeSession.status} />
  ) : null;

  useEffect(() => {
    if (!context?.session) {
      sessionRestoreGatePreparedRef.current = false;
      timeRequestResolutionCheckedStaffRef.current = null;
      return;
    }
    if (locked || loading) return;
    if (sessionRestoreGatePreparedRef.current) return;
    if (todoPopupProps.open || todoPopupProps.gateCelebration) return;
    if (screenCelebration) return;
    if (pinLoginGatePreparingRef.current) return;

    sessionRestoreGatePreparedRef.current = true;
    runPinLoginGate();
  }, [
    context?.session,
    locked,
    loading,
    screenCelebration,
    todoPopupProps.open,
    todoPopupProps.gateCelebration,
    runPinLoginGate,
  ]);

  const performLogout = useCallback(async () => {
    setActiveModule(null);
    setLocked(false);
    setContext((prev) =>
      prev?.session
        ? { ...prev, session: null, time_session: null }
        : prev,
    );
    await fetch("/api/display/pin", { method: "DELETE" });
    await refreshContext();
  }, [refreshContext]);

  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (!context?.display?.auto_lock_seconds || !context.session) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      void performLogout();
    }, context.display.auto_lock_seconds * 1000);
  }, [context?.display?.auto_lock_seconds, context?.session, performLogout]);

  /** Nach Sleep/PWA-Resume: Idle gegen lastActivity prüfen, bevor der Timer neu startet. */
  const enforceIdleOrResetTimer = useCallback(() => {
    const autoLockSeconds = context?.display?.auto_lock_seconds;
    if (!autoLockSeconds || !context.session) return;
    const idleMs = Date.now() - lastActivityRef.current;
    if (idleMs > autoLockSeconds * 1000) {
      void performLogout();
      return;
    }
    resetIdleTimer();
  }, [
    context?.display?.auto_lock_seconds,
    context?.session,
    performLogout,
    resetIdleTimer,
  ]);

  useEffect(() => {
    resetIdleTimer();
    const onActivity = () => enforceIdleOrResetTimer();
    const onResume = () => enforceIdleOrResetTimer();
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("focus", onResume);
    document.addEventListener("visibilitychange", onResume);
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("focus", onResume);
      document.removeEventListener("visibilitychange", onResume);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer, enforceIdleOrResetTimer]);

  useEffect(() => {
    const onSessionExpired = (event: Event) => {
      if (!context?.session) return;
      const detail = (event as CustomEvent<{ error?: string }>).detail;
      toast.error(displaySessionAuthErrorMessage(detail?.error));
      void performLogout();
    };
    window.addEventListener(DISPLAY_SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => {
      window.removeEventListener(
        DISPLAY_SESSION_EXPIRED_EVENT,
        onSessionExpired,
      );
    };
  }, [context?.session, performLogout]);

  const screenCelebrationRef = useRef<DisplayCelebrationVariant | null>(null);
  screenCelebrationRef.current = screenCelebration;

  const handleScreenCelebrationExitStart = useCallback(() => {
    const variant = screenCelebrationRef.current;

    if (variant === "sign_out") {
      void performLogout();
      return;
    }

    if (variant === "pin_welcome") {
      const pending = pendingPinSessionRef.current;
      pendingPinSessionRef.current = null;
      if (!pending?.ctx.session) return;
      finishPinLogin(pending.ctx);
      pinLoginGatePendingRef.current = true;
    }
  }, [finishPinLogin, performLogout]);

  const handleScreenCelebrationDone = useCallback(() => {
    const variant = screenCelebrationRef.current;

    if (pinLoginGatePendingRef.current) {
      pinLoginGatePendingRef.current = false;
      runPinLoginGate();
    } else if (
      variant === "time_request_accepted" ||
      variant === "time_request_declined"
    ) {
      const pending = pendingTimeRequestResolutionRef.current;
      pendingTimeRequestResolutionRef.current = null;
      if (pending) {
        void acknowledgeDisplayTimeRequestResolutions([pending.id]);
        if (pending.status === "approved") {
          void refreshTimeSession();
        }
      }
    }

    setScreenCelebration(null);
    setScreenCelebrationSublabel(undefined);
  }, [runPinLoginGate, refreshTimeSession]);

  const submitPin = async (pinValue: string) => {
    setPinBusy(true);
    setPinError(null);
    setLockPinError(null);
    try {
      const result = await submitDisplayPin(pinValue);
      if (!result.ok) {
        setPinError(result.message);
        setLockPinError(result.message);
        setPinRejectNonce((value) => value + 1);
        setPin("");
        return;
      }
      setPin("");
      const ctx = result.context;
      const session = ctx.session;
      if (!session) {
        setPinError("Anmeldung fehlgeschlagen.");
        return;
      }

      pendingPinSessionRef.current = { ctx, mods: session.modules };
      const givenName = session.staff.given_name?.trim();
      setScreenCelebrationSublabel(
        givenName ? `${givenName}!` : undefined,
      );
      setScreenCelebration("pin_welcome");
    } finally {
      setPinBusy(false);
    }
  };

  const unlockWithPin = async (pinValue: string) => {
    await submitPin(pinValue);
  };

  const requestLogout = useCallback(() => {
    if (screenCelebration) return;
    setScreenCelebration("sign_out");
  }, [screenCelebration]);

  const logoutAfterClockOut = useCallback(() => {
    void performLogout();
  }, [performLogout]);

  const heartbeat = useCallback(async () => {
    if (!context?.session || locked) return;
    try {
      const res = await fetch("/api/display/pin", { method: "PATCH" });
      if (await handleDisplaySessionAuthFailure(res)) return;
    } catch {
      /* offline / transient — nächster Heartbeat oder Aktion prüft erneut */
    }
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
        <DisplayChromeHeader restaurantId={context.restaurant.id} weatherEnabled />
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
        <DisplayChromeHeader restaurantId={context.restaurant?.id} weatherEnabled>
          <span className="text-sm font-medium text-foreground">PIN eingeben</span>
        </DisplayChromeHeader>

        <div className={displayChromeContentWrapClassName}>
          <DisplayPinStandbyScene accentHex={restaurantAccent}>
            <DisplayPinPad
              value={pin}
              onChange={setPin}
              disabled={pinBusy || screenCelebration === "pin_welcome"}
              busy={pinBusy}
              rejectNonce={pinRejectNonce}
              onComplete={(p) => void submitPin(p)}
            />
            {pinError ? (
              <motion.p
                key={pinError}
                className="text-sm text-destructive"
                initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduceMotion ? 0.08 : 0.22,
                  ease: MOTION_EASE_OUT,
                }}
              >
                {pinError}
              </motion.p>
            ) : null}
          </DisplayPinStandbyScene>
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

    if (modules.length === 0) {
      content = (
        <div className={displayChromeShellClassName}>
          <DisplayChromeHeader restaurantId={context.restaurant?.id} weatherEnabled>
            <DisplayStaffLine
              staff={session.staff}
              suffix={timeStatusSuffix}
              className="min-w-0 text-sm"
            />
          </DisplayChromeHeader>
          <main
            className={cn(
              displayChromeMainClassName,
              "flex flex-col items-center justify-center gap-4 p-8 text-center",
            )}
          >
            <h1 className="text-2xl font-semibold">Keine Display-Module</h1>
            <p className="max-w-md text-muted-foreground">
              Für diesen Mitarbeiter sind am Display keine Module freigeschaltet.
              Bitte Berechtigungen in den Einstellungen prüfen.
            </p>
          </main>
          <DisplayContextFooter
            restaurantName={context.restaurant?.name ?? ""}
            restaurantAvatarUrl={context.restaurant?.avatar_url}
            displayName={context.display?.name}
            showLogout={!locked}
            onLogout={requestLogout}
          />
        </div>
      );
    } else if (shouldShowDisplayModulePicker(session) && !activeModule) {
      content = (
        <div className={displayChromeShellClassName}>
          <DisplayChromeHeader
            restaurantId={context.restaurant?.id}
            weatherEnabled
            trailing={
              <DisplayStaffTodoBadge
                count={todoBadgeCount}
                urgency={todoBadgeUrgency}
                onChanged={() => void refreshTodoBadge()}
              />
            }
          >
            <DisplayStaffLine
              staff={session.staff}
              suffix={timeStatusSuffix}
              className="min-w-0 text-sm"
            />
          </DisplayChromeHeader>
          <div className={displayChromeContentWrapClassName}>
            <DisplayBrandedBackground accentHex={restaurantAccent} intensity="whisper" />
            <DisplayLockOverlay
              open={locked}
              placement="content"
              accentHex={restaurantAccent}
              onUnlock={(p) => void unlockWithPin(p)}
              busy={pinBusy}
              error={lockPinError}
            />
            <main
              className={cn(
                displayChromeMainClassName,
                "relative z-10 grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3",
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
            onLogout={requestLogout}
          />
        </div>
      );
    } else {
      const currentModule = resolveDisplayActiveModule(session, activeModule);

      if (!currentModule) {
        content = (
          <div className={displayChromeShellClassName}>
            <DisplayChromeHeader restaurantId={context.restaurant?.id} weatherEnabled />
            <main
              className={cn(
                displayChromeMainClassName,
                "flex items-center justify-center p-8 text-center text-muted-foreground",
              )}
            >
              Modul konnte nicht geladen werden.
            </main>
          </div>
        );
      } else {
      content = (
        <DisplayModuleShell
            restaurantId={context.restaurant!.id}
            accentHex={restaurantAccent}
            restaurantName={context.restaurant?.name ?? ""}
            restaurantAvatarUrl={context.restaurant?.avatar_url ?? null}
            displayName={context.display?.name ?? ""}
            staff={session.staff}
            staffSuffix={timeStatusSuffix}
            modules={moduleMeta}
            activeModule={currentModule}
            canSwitch={shouldShowDisplayModulePicker(session)}
            onModuleChange={setActiveModule}
            onLogout={requestLogout}
            todoBadgeCount={todoBadgeCount}
            todoBadgeUrgency={todoBadgeUrgency}
            onTodoChanged={() => {
              void refreshTodoBadge();
              void refreshTimeSession();
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
                restaurantId={context.restaurant!.id}
                staffId={session.staff.id}
                onSessionChange={patchTimeSession}
                prepareAndGate={prepareAndGate}
                onChanged={() => {
                  void refreshTodoBadge();
                  void refreshTimeSession();
                }}
                onClockOutSuccess={logoutAfterClockOut}
              />
            ) : null}
            {currentModule === "reservations" ? (
              <DisplayReservationsModule />
            ) : null}
            {currentModule === "recipes" ? (
              <DisplayRecipesModule
                restaurantName={context.restaurant?.name ?? undefined}
              />
            ) : null}
            {currentModule === "inventory" ? (
              <DisplayInventoryModule
                restaurantName={context.restaurant?.name ?? undefined}
              />
            ) : null}
            {currentModule === "compliance" ? <DisplayComplianceModule /> : null}
          </DisplayModuleShell>
      );
      }
    }
  }

  return (
    <DisplayRestaurantTimezoneProvider timezone={restaurantTimezone}>
      <DisplayAccentRoot accentHex={restaurantAccent}>
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={contentKey}
            className={contentKey === "pin" || contentKey === "session" ? "min-h-dvh" : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: contentRevealMs / 1000,
              ease: MOTION_EASE_OUT,
            }}
          >
            {content}
          </motion.div>
        </AnimatePresence>
        <DisplayCelebrationOverlay
          variant={screenCelebration}
          sublabel={screenCelebrationSublabel}
          onExitStart={handleScreenCelebrationExitStart}
          onDone={handleScreenCelebrationDone}
        />
        <DisplayTimeTodoPopup {...todoPopupProps} />
      </DisplayAccentRoot>
    </DisplayRestaurantTimezoneProvider>
  );
}
