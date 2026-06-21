"use client";

import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { Loader2, Coffee, LogIn, LogOut, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DisplayTimeTeamPresence } from "@/components/display/modules/display-time-team-presence";
import {
  DisplayTimeTodoPopup,
  useDisplayTimeTodoGate,
} from "@/components/display/modules/display-time-todo-popup";
import { StaffWorkEntryTypeStripe } from "@/components/staff/staff-work-entry-type-stripe";
import { displayModuleContentClassName } from "@/lib/ui/display-module-content";
import {
  displayTimeActionButtonOutlineClassName,
  displayTimeActionButtonPrimaryClassName,
} from "@/lib/ui/display-time-action-button";
import type { DisplayTeamPresenceMember } from "@/lib/types/staff";
import type { StaffWorkEntryType } from "@/lib/types/staff";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TimeState = {
  status: "off" | "working" | "on_break";
  clocked_in_at: string | null;
  break_started_at: string | null;
};

type TimePayload = TimeState & {
  can_view_team_presence?: boolean;
  team_presence?: DisplayTeamPresenceMember[];
};

const timeFmt = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

function statusLabel(status: TimeState["status"]): string {
  switch (status) {
    case "working":
      return "In Schicht";
    case "on_break":
      return "In Pause";
    default:
      return "Nicht eingestempelt";
  }
}

type TimeAction = "clock_in" | "start_break" | "end_break" | "clock_out";

function pendingStatusLabel(action: TimeAction): string {
  switch (action) {
    case "clock_in":
      return "Schicht wird gestartet …";
    case "start_break":
      return "Pause wird gestartet …";
    case "end_break":
      return "Pause wird beendet …";
    case "clock_out":
      return "Schicht wird beendet …";
  }
}

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

export function DisplayTimeModule({
  initial,
  onChanged,
}: {
  initial: TimeState | null;
  onChanged: () => void;
}) {
  const [state, setState] = useState<TimeState>(
    initial ?? { status: "off", clocked_in_at: null, break_started_at: null },
  );
  const [canViewTeamPresence, setCanViewTeamPresence] = useState(false);
  const [teamPresence, setTeamPresence] = useState<DisplayTeamPresenceMember[]>(
    [],
  );
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<TimeAction | null>(null);
  const { prepareAndGate, popupProps } = useDisplayTimeTodoGate();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/display/time", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as TimePayload;
      setState({
        status: data.status,
        clocked_in_at: data.clocked_in_at,
        break_started_at: data.break_started_at,
      });
      setCanViewTeamPresence(data.can_view_team_presence === true);
      setTeamPresence(data.team_presence ?? []);
    } catch {
      /* ignore background refresh */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const runTimeAction = useCallback(
    async (
      action: TimeAction,
      options?: { skipStateUpdate?: boolean },
    ): Promise<boolean> => {
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
      if (!options?.skipStateUpdate) {
        setState((prev) => optimisticStateForAction(action, prev));
      }
      onChanged();
      void refresh();
      return true;
    },
    [onChanged, refresh],
  );

  const runAction = useCallback(
    async (action: TimeAction) => {
      setPendingAction(action);
      setBusy(true);
      const snapshot = state;
      try {
        const gate = await prepareAndGate(action);
        if (gate === "blocked") return;

        setState(optimisticStateForAction(action, snapshot));
        setPendingAction(null);

        const ok = await runTimeAction(action, { skipStateUpdate: true });
        if (!ok) {
          setState(snapshot);
          void refresh();
        }
      } finally {
        setPendingAction(null);
        setBusy(false);
      }
    },
    [prepareAndGate, runTimeAction, state],
  );

  const displayStatus = pendingAction
    ? pendingStatusLabel(pendingAction)
    : statusLabel(state.status);

  const since =
    state.clocked_in_at && state.status !== "off"
      ? timeFmt.format(new Date(state.clocked_in_at))
      : null;

  function actionButtonBusy(action: TimeAction) {
    return pendingAction === action;
  }

  return (
    <div className={cn(displayModuleContentClassName, "max-w-lg items-center gap-8")}>
      <div className="text-center">
        <p
          className={cn(
            "text-sm font-medium uppercase tracking-wide transition-colors",
            pendingAction
              ? "text-muted-foreground"
              : state.status === "working"
                ? "text-emerald-600"
                : state.status === "on_break"
                  ? "text-amber-600"
                  : "text-muted-foreground",
          )}
        >
          {displayStatus}
        </p>
        {since ? (
          <p className="mt-2 text-4xl font-semibold tabular-nums">seit {since}</p>
        ) : pendingAction ? (
          <p className="mt-2 text-2xl text-muted-foreground/80">…</p>
        ) : (
          <p className="mt-2 text-2xl text-muted-foreground">
            Bereit für die Schicht?
          </p>
        )}
      </div>

      <div className="flex w-full flex-col gap-3">
        {state.status === "off" ? (
          <DisplayTimeActionButton
            size="lg"
            stripeType="work"
            disabled={busy}
            onClick={() => void runAction("clock_in")}
          >
            {actionButtonBusy("clock_in") ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <LogIn className="size-5" />
            )}
            Schicht starten
          </DisplayTimeActionButton>
        ) : null}

        {state.status === "working" ? (
          <>
            <DisplayTimeActionButton
              size="lg"
              variant="outline"
              stripeType="break"
              disabled={busy}
              onClick={() => void runAction("start_break")}
            >
              {actionButtonBusy("start_break") ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Pause className="size-5" />
              )}
              Pause starten
            </DisplayTimeActionButton>
            <Button
              size="lg"
              variant="destructive"
              className="h-16 rounded-2xl text-lg"
              disabled={busy}
              onClick={() => void runAction("clock_out")}
            >
              {actionButtonBusy("clock_out") ? (
                <Loader2 className="mr-2 size-5 animate-spin" />
              ) : (
                <LogOut className="mr-2 size-5" />
              )}
              Schicht beenden
            </Button>
          </>
        ) : null}

        {state.status === "on_break" ? (
          <>
            <DisplayTimeActionButton
              size="lg"
              stripeType="break"
              disabled={busy}
              onClick={() => void runAction("end_break")}
            >
              {actionButtonBusy("end_break") ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Coffee className="size-5" />
              )}
              Pause beenden
            </DisplayTimeActionButton>
            <Button
              size="lg"
              variant="destructive"
              className="h-16 rounded-2xl text-lg"
              disabled={busy}
              onClick={() => void runAction("clock_out")}
            >
              {actionButtonBusy("clock_out") ? (
                <Loader2 className="mr-2 size-5 animate-spin" />
              ) : (
                <LogOut className="mr-2 size-5" />
              )}
              Schicht beenden
            </Button>
          </>
        ) : null}
      </div>

      {canViewTeamPresence ? (
        <DisplayTimeTeamPresence members={teamPresence} />
      ) : null}

      <DisplayTimeTodoPopup {...popupProps} />
    </div>
  );
}
