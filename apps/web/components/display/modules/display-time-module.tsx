"use client";

import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Coffee, LogIn, LogOut, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DisplayTimeTeamPresence } from "@/components/display/modules/display-time-team-presence";
import {
  DisplayTimeRequestSheet,
  useDisplayTimeRequestPending,
} from "@/components/display/modules/display-time-request-sheet";
import {
  DisplayTimeActionCelebration,
  type DisplayTimeCelebrationAction,
} from "@/components/display/display-celebration-overlay";
import type { DisplayPrepareAndGate } from "@/components/display/modules/display-shift-gates";
import { StaffWorkEntryTypeStripe } from "@/components/staff/staff-work-entry-type-stripe";
import { GWADA_DISPLAY_TIME_REFRESH_EVENT } from "@/lib/display/display-time-live-events";
import { displayModuleContentClassName } from "@/lib/ui/display-module-content";
import {
  displayTimeActionButtonOutlineClassName,
  displayTimeActionButtonPrimaryClassName,
} from "@/lib/ui/display-time-action-button";
import {
  DISPLAY_CELEBRATION_EXIT_MS,
  DISPLAY_CELEBRATION_EXIT_REDUCED_MS,
  MOTION_EASE_IN_OUT,
  MOTION_EASE_OUT,
} from "@/lib/ui/motion-presets";
import {
  displayTimeStatusClassName,
  displayTimeStatusLabel,
  type DisplayTimeSessionState,
} from "@/lib/display/display-time-status";
import type { DisplayTeamPresenceMember } from "@/lib/types/staff";
import type { StaffWorkEntryType } from "@/lib/types/staff";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TimeState = DisplayTimeSessionState;

type TimePayload = TimeState & {
  can_view_team_presence?: boolean;
  team_presence?: DisplayTeamPresenceMember[];
};

const timeFmt = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

type TimeAction = "clock_in" | "start_break" | "end_break" | "clock_out";

function optimisticStateForAction(
  action: TimeAction,
  prev: TimeState,
): TimeState {
  const now = new Date().toISOString();
  switch (action) {
    case "clock_in":
      return {
        status: "working",
        clocked_in_at: prev.clocked_in_at ?? now,
        break_started_at: null,
      };
    case "start_break":
      return {
        ...prev,
        status: "on_break",
        break_started_at: now,
      };
    case "end_break":
      return {
        ...prev,
        status: "working",
        break_started_at: null,
      };
    case "clock_out":
      return {
        status: "off",
        clocked_in_at: null,
        break_started_at: null,
      };
  }
}

function DisplayTimeActionButton({
  stripeType,
  children,
  className,
  variant = "default",
  ...props
}: ComponentProps<typeof Button> & {
  stripeType?: StaffWorkEntryType;
}) {
  return (
    <Button
      {...props}
      variant={variant}
      className={cn(
        variant === "outline"
          ? displayTimeActionButtonOutlineClassName
          : displayTimeActionButtonPrimaryClassName,
        className,
      )}
    >
      {stripeType ? (
        <StaffWorkEntryTypeStripe
          type={stripeType}
          className="absolute bottom-3 left-3 top-3 w-1.5"
        />
      ) : null}
      <span className="flex w-full items-center justify-center gap-2">
        {children}
      </span>
    </Button>
  );
}

const displayTimeDestructiveButtonClassName =
  "h-16 w-full rounded-2xl text-lg transition-transform active:scale-[0.98]";

export function DisplayTimeModule({
  initial,
  onChanged,
  onSessionChange,
  onClockOutSuccess,
  prepareAndGate,
}: {
  initial: TimeState | null;
  onChanged: () => void;
  /** Live-Sync für Kopfzeile o. Ä. */
  onSessionChange?: (state: TimeState) => void;
  /** Nach Ausstempeln oder Pausenstart (nach Celebration) Display-Session beenden. */
  onClockOutSuccess?: () => void;
  prepareAndGate: DisplayPrepareAndGate;
}) {
  const [state, setState] = useState<TimeState>(
    initial ?? { status: "off", clocked_in_at: null, break_started_at: null },
  );
  const [canViewTeamPresence, setCanViewTeamPresence] = useState(false);
  const [teamPresence, setTeamPresence] = useState<DisplayTeamPresenceMember[]>(
    [],
  );
  const [celebrationAction, setCelebrationAction] =
    useState<DisplayTimeCelebrationAction | null>(null);
  const [contentHidden, setContentHidden] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [requestSheetOpen, setRequestSheetOpen] = useState(false);
  const { pending: pendingTimeRequest, refresh: refreshPendingTimeRequest } =
    useDisplayTimeRequestPending();
  const reduceMotion = useReducedMotion() ?? false;
  const contentRevealSec =
    (reduceMotion ? DISPLAY_CELEBRATION_EXIT_REDUCED_MS : DISPLAY_CELEBRATION_EXIT_MS) /
    1000;
  const inFlightRef = useRef(false);
  const pendingClockOutLogoutRef = useRef(false);
  const pendingCelebrationSyncRef = useRef(false);
  const onClockOutSuccessRef = useRef(onClockOutSuccess);
  onClockOutSuccessRef.current = onClockOutSuccess;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    onSessionChange?.(state);
  }, [state, onSessionChange]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/display/time", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as TimePayload;
      setState((prev) => {
        const next = {
          status: data.status,
          clocked_in_at: data.clocked_in_at,
          break_started_at: data.break_started_at,
        };
        if (
          prev.status === next.status &&
          prev.clocked_in_at === next.clocked_in_at &&
          prev.break_started_at === next.break_started_at
        ) {
          return prev;
        }
        return next;
      });
      setCanViewTeamPresence(data.can_view_team_presence === true);
      setTeamPresence(data.team_presence ?? []);
    } catch {
      /* ignore background refresh */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const fallbackId = setInterval(() => void refresh(), 90_000);
    const onLiveRefresh = () => {
      void refresh();
    };
    window.addEventListener(GWADA_DISPLAY_TIME_REFRESH_EVENT, onLiveRefresh);
    return () => {
      clearInterval(fallbackId);
      window.removeEventListener(GWADA_DISPLAY_TIME_REFRESH_EVENT, onLiveRefresh);
    };
  }, [refresh]);

  const runTimeAction = useCallback(
    async (action: TimeAction): Promise<boolean> => {
      const res = await fetch("/api/display/time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { error?: string; status?: TimeState["status"] };
      if (!res.ok) {
        toast.error(
          data.error === "already_clocked_in"
            ? "Schicht läuft bereits."
            : data.error === "not_clocked_in"
              ? "Bitte zuerst Schicht starten."
              : "Aktion fehlgeschlagen.",
        );
        return false;
      }
      return true;
    },
    [],
  );

  const beginAction = useCallback(
    (action: TimeAction) => {
      if (actionBusy || celebrationAction || inFlightRef.current) return;
      const snapshot = stateRef.current;
      inFlightRef.current = true;
      setActionBusy(true);

      void (async () => {
        try {
          const gate = await prepareAndGate(action);
          if (gate === "blocked") return;

          setCelebrationAction(action);
          setContentHidden(true);
          setState(optimisticStateForAction(action, snapshot));

          const ok = await runTimeAction(action);
          if (!ok) {
            pendingCelebrationSyncRef.current = false;
            pendingClockOutLogoutRef.current = false;
            setCelebrationAction(null);
            setContentHidden(false);
            setState(snapshot);
            void refresh();
          } else {
            void refresh();
            pendingCelebrationSyncRef.current = true;
            if (action === "clock_out" || action === "start_break") {
              pendingClockOutLogoutRef.current = true;
            }
          }
        } finally {
          inFlightRef.current = false;
          setActionBusy(false);
        }
      })();
    },
    [actionBusy, celebrationAction, prepareAndGate, runTimeAction, refresh],
  );

  const actionsBlocked = actionBusy || Boolean(celebrationAction);

  const since =
    state.clocked_in_at && state.status !== "off"
      ? timeFmt.format(new Date(state.clocked_in_at))
      : null;

  const statusTransition = {
    duration: celebrationAction || reduceMotion ? 0 : 0.42,
    ease: MOTION_EASE_OUT,
  } as const;

  return (
    <div className={displayModuleContentClassName}>
      <DisplayTimeRequestSheet
        open={requestSheetOpen}
        onOpenChange={setRequestSheetOpen}
        disabled={actionsBlocked}
        onChanged={() => {
          void refreshPendingTimeRequest();
          onChanged();
        }}
      />
      <div className="relative mx-auto flex w-full max-w-md flex-col gap-8">
      <DisplayTimeActionCelebration
        action={celebrationAction}
        onExitStart={() => {
          if (pendingClockOutLogoutRef.current) {
            pendingCelebrationSyncRef.current = false;
            onClockOutSuccessRef.current?.();
          }
          setContentHidden(false);
        }}
        onDone={() => {
          if (pendingClockOutLogoutRef.current) {
            pendingClockOutLogoutRef.current = false;
            setCelebrationAction(null);
            setContentHidden(false);
            return;
          }
          setCelebrationAction(null);
          if (pendingCelebrationSyncRef.current) {
            pendingCelebrationSyncRef.current = false;
            void refresh();
            onChanged();
          }
        }}
      />

      <motion.div
        className="flex w-full flex-col gap-8"
        aria-hidden={contentHidden ? true : undefined}
        initial={false}
        animate={{ opacity: contentHidden ? 0 : 1 }}
        transition={{
          duration: contentHidden ? 0 : contentRevealSec,
          ease: MOTION_EASE_IN_OUT,
        }}
      >
      <div className="relative w-full text-center">
        <div className="absolute right-0 top-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="relative rounded-full border-border/60"
            disabled={actionsBlocked}
            onClick={() => setRequestSheetOpen(true)}
          >
            Nachtragen
            {pendingTimeRequest ? (
              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-accent" />
            ) : null}
          </Button>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={state.status}
            className={cn(
              "text-sm font-medium uppercase tracking-wide",
              displayTimeStatusClassName(state.status),
            )}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
            transition={statusTransition}
          >
            {displayTimeStatusLabel(state.status)}
          </motion.p>
        </AnimatePresence>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={since ?? "idle"}
            className="mt-2"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
            transition={statusTransition}
          >
            {since ? (
              <p className="text-4xl font-semibold tabular-nums">seit {since}</p>
            ) : (
              <p className="text-2xl text-muted-foreground">Bereit für die Schicht?</p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex w-full flex-col gap-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {state.status === "off" ? (
            <motion.div
              key="clock-in"
              layout
              className="w-full"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
              transition={statusTransition}
            >
              <DisplayTimeActionButton
                size="lg"
                stripeType="work"
                disabled={actionsBlocked}
                onClick={() => beginAction("clock_in")}
              >
                <LogIn className="size-5" />
                Schicht starten
              </DisplayTimeActionButton>
            </motion.div>
          ) : null}

          {state.status === "working" ? (
            <motion.div
              key="working-actions"
              layout
              className="flex w-full flex-col gap-3"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
              transition={statusTransition}
            >
              <DisplayTimeActionButton
                size="lg"
                variant="outline"
                stripeType="break"
                disabled={actionsBlocked}
                onClick={() => beginAction("start_break")}
              >
                <Pause className="size-5" />
                Pause starten
              </DisplayTimeActionButton>
              <Button
                size="lg"
                variant="destructive"
                className={displayTimeDestructiveButtonClassName}
                disabled={actionsBlocked}
                onClick={() => beginAction("clock_out")}
              >
                <LogOut className="mr-2 size-5" />
                Schicht beenden
              </Button>
            </motion.div>
          ) : null}

          {state.status === "on_break" ? (
            <motion.div
              key="break-actions"
              layout
              className="flex w-full flex-col gap-3"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
              transition={statusTransition}
            >
              <DisplayTimeActionButton
                size="lg"
                stripeType="break"
                disabled={actionsBlocked}
                onClick={() => beginAction("end_break")}
              >
                <Coffee className="size-5" />
                Pause beenden
              </DisplayTimeActionButton>
              <Button
                size="lg"
                variant="destructive"
                className={displayTimeDestructiveButtonClassName}
                disabled={actionsBlocked}
                onClick={() => beginAction("clock_out")}
              >
                <LogOut className="mr-2 size-5" />
                Schicht beenden
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      </motion.div>
      </div>

      {canViewTeamPresence ? (
        <DisplayTimeTeamPresence members={teamPresence} className="w-full" />
      ) : null}
    </div>
  );
}
