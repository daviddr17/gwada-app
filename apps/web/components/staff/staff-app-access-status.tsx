"use client";

import { Smartphone, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  resolveStaffAppAccessState,
  staffAppAccessProfileLabel,
  type StaffAppAccessFields,
} from "@/lib/staff/staff-app-access";
import { cn } from "@/lib/utils";

type StaffAppAccessStatusProps = StaffAppAccessFields & {
  variant?: "table" | "drawer";
  className?: string;
};

export function StaffAppAccessStatus({
  profile_id,
  linked_profile,
  linked_employee,
  variant = "table",
  className,
}: StaffAppAccessStatusProps) {
  const state = resolveStaffAppAccessState({
    profile_id,
    linked_profile,
    linked_employee,
  });
  const profileLabel = staffAppAccessProfileLabel({
    profile_id,
    linked_profile,
    linked_employee,
  });

  if (variant === "table") {
    if (state === "none") {
      return (
        <span className={cn("text-xs text-muted-foreground", className)}>
          Kein Zugang
        </span>
      );
    }

    return (
      <div className={cn("space-y-0.5", className)}>
        <Badge
          variant={state === "active" ? "secondary" : "outline"}
          className={cn(
            "gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium",
            state === "active" &&
              "border-green-500/25 bg-green-500/10 text-green-800 dark:text-green-200",
            state === "revoked" &&
              "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100",
          )}
        >
          <Smartphone className="size-3 shrink-0" aria-hidden />
          {state === "active" ? "Dashboard" : "Deaktiviert"}
        </Badge>
        {profileLabel ? (
          <p className="max-w-[9rem] truncate text-[11px] text-muted-foreground">
            {profileLabel}
          </p>
        ) : null}
      </div>
    );
  }

  if (state === "none") {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-border/60 bg-muted/15 px-3 py-2.5",
          className,
        )}
      >
        <p className="text-sm font-medium text-foreground">Kein App-Zugang</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Noch kein eigener Login zum Dashboard — Einladung unten senden.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        state === "active"
          ? "border-green-500/25 bg-green-500/5"
          : "border-amber-500/30 bg-amber-500/5",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
            state === "active"
              ? "bg-green-500/15 text-green-700 dark:text-green-200"
              : "bg-amber-500/15 text-amber-800 dark:text-amber-100",
          )}
          aria-hidden
        >
          {state === "active" ? (
            <Smartphone className="size-4" />
          ) : (
            <UserRound className="size-4" />
          )}
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium text-foreground">
            {state === "active"
              ? "Eigener Dashboard-Zugang"
              : "Dashboard-Zugang deaktiviert"}
          </p>
          {profileLabel ? (
            <p className="text-xs text-muted-foreground">
              App-Nutzer:{" "}
              <span className="font-medium text-foreground">{profileLabel}</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Mit eigenem App-Konto verbunden
            </p>
          )}
          {state === "revoked" ? (
            <p className="text-xs text-amber-800 dark:text-amber-100">
              Restaurant-Zugang ist deaktiviert — erneut einladen oder in den
              Einstellungen aktivieren.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Kann sich in der App anmelden und das Dashboard nutzen.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
