"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverPositioner,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useOpsSessionPrefs } from "@/lib/hooks/use-ops-session-prefs";
import {
  getOpsRealtimeHealth,
  subscribeOpsRealtimeHealth,
} from "@/lib/ops/ops-realtime-health";
import {
  createRestaurantDateTimeFormatter,
} from "@/lib/restaurant/restaurant-timezone";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

/**
 * Desktop-only Ops-Status: Live-Punkt + Ruhe-Modus.
 * Mobil bewusst weggelassen (episodische Nutzung).
 */
export function AppChromeOpsStatus({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const timeZone = useRestaurantIanaTimezone(restaurantId);
  const { quietMode, toggleQuietMode } = useOpsSessionPrefs();
  const health = useSyncExternalStore(
    subscribeOpsRealtimeHealth,
    getOpsRealtimeHealth,
    getOpsRealtimeHealth,
  );

  const dayLabel = useMemo(
    () =>
      createRestaurantDateTimeFormatter(timeZone, {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(new Date()),
    [timeZone],
  );

  const live = health.live || health.channelCount === 0;
  // channelCount===0: noch kein Subscribe / Proxy — nicht als Fehler zeigen
  const statusLabel = quietMode
    ? "Ruhe"
    : health.channelCount === 0
      ? "Bereit"
      : health.live
        ? "Live"
        : "Sync…";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "hidden h-8 shrink-0 gap-1.5 rounded-full border-border/60 px-2.5 text-xs font-medium md:inline-flex",
              quietMode && "border-amber-500/40 bg-amber-500/10",
              className,
            )}
            aria-label={`Betrieb: ${statusLabel}`}
          />
        }
      >
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            quietMode
              ? "bg-amber-500"
              : live
                ? "bg-emerald-500"
                : "bg-muted-foreground/50",
          )}
          aria-hidden
        />
        <span className="max-w-[7rem] truncate tabular-nums text-muted-foreground">
          {dayLabel}
        </span>
        <span className="text-foreground">{statusLabel}</span>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverPositioner side="bottom" align="end" sideOffset={8}>
          <PopoverContent className="w-64 p-3">
            <p className="text-sm font-medium text-foreground">Betrieb</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Status für den Stations-PC — Live-Verlauf und Glocke bleiben
              aktiv.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/50 bg-muted/30 px-2.5 py-2 text-xs">
              {health.live || health.channelCount === 0 ? (
                <Wifi className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <WifiOff className="size-3.5 text-muted-foreground" />
              )}
              <span className="text-muted-foreground">
                {health.channelCount === 0
                  ? "Kanäle starten …"
                  : health.live
                    ? `${health.connectedCount}/${health.channelCount} Live`
                    : "Verbindung wird aufgebaut …"}
              </span>
            </div>
            <Button
              type="button"
              variant={quietMode ? "default" : "outline"}
              size="sm"
              className="mt-3 w-full justify-start gap-2 rounded-xl"
              onClick={() => {
                toggleQuietMode();
              }}
            >
              {quietMode ? (
                <Moon className="size-3.5" />
              ) : (
                <Sun className="size-3.5" />
              )}
              {quietMode ? "Ruhe-Modus an" : "Ruhe-Modus aus"}
            </Button>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Ruhe: keine Live-Toasts — Ereignisse nur im Live-Verlauf.
            </p>
          </PopoverContent>
        </PopoverPositioner>
      </PopoverPortal>
    </Popover>
  );
}
