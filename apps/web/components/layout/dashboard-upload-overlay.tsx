"use client";

import { useEffect, useState } from "react";
import { DashboardUploadSuccessCelebration } from "@/components/layout/dashboard-upload-success-celebration";
import {
  subscribeDashboardUploadState,
  type DashboardUploadState,
} from "@/lib/uploads/dashboard-upload-bus";
import { cn } from "@/lib/utils";

export function DashboardUploadOverlay() {
  const [state, setState] = useState<DashboardUploadState>({
    phase: "idle",
    progress: 0,
    message: "Wird hochgeladen …",
    successMessage: "",
    active: false,
  });

  useEffect(() => subscribeDashboardUploadState(setState), []);

  const progressLabel = `${Math.min(100, Math.round(state.progress))}`;
  const uploading = state.phase === "uploading";

  return (
    <>
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-[200] flex items-center justify-center transition-opacity duration-300 ease-out motion-reduce:transition-none",
          uploading ? "opacity-100" : "opacity-0",
        )}
        role="status"
        aria-live="polite"
        aria-busy={uploading}
        aria-label={
          uploading ? `${state.message}, ${progressLabel} Prozent` : undefined
        }
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/30 backdrop-blur-xl motion-reduce:backdrop-blur-sm",
            uploading ? "pointer-events-auto" : "pointer-events-none",
          )}
          aria-hidden
        />

        <div
          className={cn(
            "relative w-[min(19rem,calc(100%-2.5rem))] overflow-hidden rounded-[1.375rem] border border-white/25 bg-background/80 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.45)] backdrop-blur-2xl transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none dark:border-white/10 dark:bg-background/70",
            uploading
              ? "scale-100 opacity-100"
              : "scale-[0.98] opacity-0",
          )}
        >
          <div className="px-5 pt-5 pb-4 text-center">
            <p className="text-[15px] font-semibold tracking-tight text-foreground">
              {state.message}
            </p>
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              {progressLabel}&nbsp;%
            </p>
          </div>

          <div className="px-5 pb-5">
            <div
              className="h-1 overflow-hidden rounded-full bg-foreground/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, Math.round(state.progress))}
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out motion-reduce:transition-none"
                style={{ width: `${Math.min(100, state.progress)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <DashboardUploadSuccessCelebration
        open={state.phase === "success"}
        title={state.successMessage || "Hochgeladen"}
      />
    </>
  );
}
