"use client";

import { useCallback, useState } from "react";
import { Loader2, Coffee, LogIn, LogOut, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TimeState = {
  status: "off" | "working" | "on_break";
  clocked_in_at: string | null;
  break_started_at: string | null;
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
  const [busy, setBusy] = useState(false);

  const runAction = useCallback(
    async (action: "clock_in" | "start_break" | "end_break" | "clock_out") => {
      setBusy(true);
      try {
        const res = await fetch("/api/display/time", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
          return;
        }
        if (action === "clock_in") {
          setState({
            status: "working",
            clocked_in_at: new Date().toISOString(),
            break_started_at: null,
          });
        } else if (action === "start_break") {
          setState((s) => ({
            ...s,
            status: "on_break",
            break_started_at: new Date().toISOString(),
          }));
        } else if (action === "end_break") {
          setState((s) => ({
            ...s,
            status: "working",
            break_started_at: null,
          }));
        } else {
          setState({
            status: "off",
            clocked_in_at: null,
            break_started_at: null,
          });
        }
        onChanged();
      } finally {
        setBusy(false);
      }
    },
    [onChanged],
  );

  const since =
    state.clocked_in_at && state.status !== "off"
      ? timeFmt.format(new Date(state.clocked_in_at))
      : null;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-8 py-8">
      <div className="text-center">
        <p
          className={cn(
            "text-sm font-medium uppercase tracking-wide",
            state.status === "working"
              ? "text-emerald-600"
              : state.status === "on_break"
                ? "text-amber-600"
                : "text-muted-foreground",
          )}
        >
          {statusLabel(state.status)}
        </p>
        {since ? (
          <p className="mt-2 text-4xl font-semibold tabular-nums">seit {since}</p>
        ) : (
          <p className="mt-2 text-2xl text-muted-foreground">
            Bereit für die Schicht?
          </p>
        )}
      </div>

      <div className="flex w-full flex-col gap-3">
        {state.status === "off" ? (
          <Button
            size="lg"
            className="h-16 rounded-2xl text-lg"
            disabled={busy}
            onClick={() => void runAction("clock_in")}
          >
            {busy ? (
              <Loader2 className="mr-2 size-5 animate-spin" />
            ) : (
              <LogIn className="mr-2 size-5" />
            )}
            Schicht starten
          </Button>
        ) : null}

        {state.status === "working" ? (
          <>
            <Button
              size="lg"
              variant="outline"
              className="h-16 rounded-2xl text-lg"
              disabled={busy}
              onClick={() => void runAction("start_break")}
            >
              {busy ? (
                <Loader2 className="mr-2 size-5 animate-spin" />
              ) : (
                <Pause className="mr-2 size-5" />
              )}
              Pause starten
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="h-16 rounded-2xl text-lg"
              disabled={busy}
              onClick={() => void runAction("clock_out")}
            >
              {busy ? (
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
            <Button
              size="lg"
              className="h-16 rounded-2xl text-lg"
              disabled={busy}
              onClick={() => void runAction("end_break")}
            >
              {busy ? (
                <Loader2 className="mr-2 size-5 animate-spin" />
              ) : (
                <Coffee className="mr-2 size-5" />
              )}
              Pause beenden
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="h-16 rounded-2xl text-lg"
              disabled={busy}
              onClick={() => void runAction("clock_out")}
            >
              Schicht beenden
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
