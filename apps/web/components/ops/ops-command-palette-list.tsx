"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useOpsSessionPrefs } from "@/lib/hooks/use-ops-session-prefs";
import {
  OPS_COMMANDS,
  dispatchOpsOpenCalendar,
  opsCommandIconForQuiet,
  type OpsCommand,
} from "@/lib/ops/ops-commands";
import { cn } from "@/lib/utils";

export function OpsCommandPaletteList({
  onClose,
  className,
}: {
  onClose: () => void;
  className?: string;
}) {
  const router = useRouter();
  const { quietMode, toggleQuietMode } = useOpsSessionPrefs();

  const run = (cmd: OpsCommand) => {
    if (cmd.action === "toggle_quiet") {
      const next = toggleQuietMode();
      toast.message(next ? "Ruhe-Modus an" : "Ruhe-Modus aus", {
        description: next
          ? "Live-Toasts pausiert — Verlauf bleibt aktiv."
          : "Live-Toasts wieder aktiv.",
        duration: 2_400,
      });
      onClose();
      return;
    }
    if (cmd.action === "open_calendar") {
      onClose();
      dispatchOpsOpenCalendar();
      router.push("/dashboard");
      return;
    }
    if (cmd.href) {
      onClose();
      router.push(cmd.href);
    }
  };

  return (
    <div className={cn("space-y-3 pb-2", className)}>
      <div className="px-2 pt-1">
        <p className="text-sm font-medium text-foreground">Schnellaktionen</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Tippen oder tippen — danach Suche mit mind. 2 Zeichen.
        </p>
      </div>
      <ul className="space-y-1">
        {OPS_COMMANDS.map((cmd) => {
          const Icon =
            cmd.action === "toggle_quiet"
              ? opsCommandIconForQuiet(quietMode)
              : cmd.icon;
          const label =
            cmd.action === "toggle_quiet"
              ? quietMode
                ? "Ruhe-Modus aus"
                : "Ruhe-Modus an"
              : cmd.label;
          return (
            <li key={cmd.id}>
              <button
                type="button"
                className="flex w-full items-start gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border/50 hover:bg-muted/40"
                onClick={() => run(cmd)}
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-card/80">
                  <Icon className="size-4 text-muted-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {label}
                  </span>
                  {cmd.hint ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {cmd.hint}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
