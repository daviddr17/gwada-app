"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PlatformFeedSyncStatusMeta = {
  lastSyncedAt: string | null;
  stale: boolean;
  platformErrors?: Partial<Record<string, string>>;
};

type PlatformFeedSyncStatusBarProps = {
  syncMeta: PlatformFeedSyncStatusMeta | null | undefined;
  syncing: boolean;
  onSyncNow: () => void;
  platformLabels?: Record<string, string>;
};

export function PlatformFeedSyncStatusBar({
  syncMeta,
  syncing,
  onSyncNow,
  platformLabels = {},
}: PlatformFeedSyncStatusBarProps) {
  if (!syncMeta?.stale && !syncMeta?.lastSyncedAt) return null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {syncMeta.lastSyncedAt ? (
            <>
              Externe Kanäle zuletzt aktualisiert:{" "}
              {new Date(syncMeta.lastSyncedAt).toLocaleString("de-DE", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </>
          ) : (
            "Externe Kanäle werden synchronisiert …"
          )}
          {syncMeta.stale ? " · Aktualisierung läuft …" : null}
        </p>
        {syncMeta.stale || syncing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full border-border/60"
            disabled={syncing}
            onClick={onSyncNow}
          >
            <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
            Jetzt synchronisieren
          </Button>
        ) : null}
      </div>

      {syncMeta.platformErrors &&
      Object.keys(syncMeta.platformErrors).length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          {Object.entries(syncMeta.platformErrors).map(([platform, message]) => (
            <p key={platform}>
              {platformLabels[platform] ?? platform}: {message}
            </p>
          ))}
        </div>
      ) : null}
    </>
  );
}
