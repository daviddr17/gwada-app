"use client";

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PlatformFeedSyncStatusMeta = {
  lastSyncedAt: string | null;
  stale: boolean;
  /** Interne Sync-Fehler — nicht in Endnutzer-UI rendern. */
  platformErrors?: Partial<Record<string, string>>;
};

export type PlatformFeedListSyncProps = {
  syncMeta: PlatformFeedSyncStatusMeta | null | undefined;
  syncing: boolean;
  onSyncNow: () => void;
};

export function platformFeedSyncMetaVisible(
  syncMeta: PlatformFeedSyncStatusMeta | null | undefined,
): boolean {
  return Boolean(syncMeta?.stale || syncMeta?.lastSyncedAt);
}

export function formatPlatformFeedSyncMetaText(
  syncMeta: PlatformFeedSyncStatusMeta,
): string {
  if (syncMeta.lastSyncedAt) {
    const formatted = new Date(syncMeta.lastSyncedAt).toLocaleString("de-DE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const base = `Externe Kanäle zuletzt aktualisiert: ${formatted}`;
    return syncMeta.stale ? `${base} · Aktualisierung läuft …` : base;
  }
  const base = "Externe Kanäle werden synchronisiert …";
  return syncMeta.stale ? `${base} · Aktualisierung läuft …` : base;
}

export function joinListMetaSummary(
  ...parts: Array<string | null | undefined>
): string | null {
  const joined = parts.filter((part) => part?.trim()).join(" · ");
  return joined || null;
}

export function PlatformFeedSyncNowButton({
  syncing,
  onSyncNow,
  className,
}: {
  syncing: boolean;
  onSyncNow: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("rounded-full border-border/60", className)}
      disabled={syncing}
      onClick={onSyncNow}
    >
      <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
      Jetzt synchronisieren
    </Button>
  );
}

/** Zeile wie ListPagination oben: Zähler + Sync-Text links, Aktionen rechts. */
export function PlatformFeedListMetaRow({
  summaryPrefix,
  feedSync,
  trailing,
  placement = "above",
  className,
}: {
  summaryPrefix?: string | null;
  feedSync?: PlatformFeedListSyncProps;
  trailing?: ReactNode;
  placement?: "above" | "below";
  className?: string;
}) {
  const syncVisible =
    feedSync != null && platformFeedSyncMetaVisible(feedSync.syncMeta);
  const summary = joinListMetaSummary(
    summaryPrefix,
    syncVisible && feedSync?.syncMeta
      ? formatPlatformFeedSyncMetaText(feedSync.syncMeta)
      : null,
  );

  if (!summary && !trailing) return null;

  const showSyncButton =
    syncVisible &&
    feedSync != null &&
    (feedSync.syncMeta!.stale || feedSync.syncing);

  return (
    <div
      className={cn(
        "flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1",
        placement === "above"
          ? "border-b border-border/50 pb-4"
          : "border-t border-border/50 pt-4",
        className,
      )}
    >
      {summary ? (
        <p className="min-w-0 text-sm text-muted-foreground tabular-nums">
          {summary}
        </p>
      ) : (
        <span className="min-w-0 flex-1" aria-hidden />
      )}
      {showSyncButton || trailing ? (
        <div className="flex flex-wrap items-center gap-2">
          {showSyncButton && feedSync ? (
            <PlatformFeedSyncNowButton
              syncing={feedSync.syncing}
              onSyncNow={feedSync.onSyncNow}
            />
          ) : null}
          {trailing}
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Nutze `feedSync` an `ListPagination` / `PlatformFeedListMetaRow`. */
export function PlatformFeedSyncStatusBar({
  syncMeta,
  syncing,
  onSyncNow,
}: PlatformFeedListSyncProps) {
  if (!platformFeedSyncMetaVisible(syncMeta)) return null;

  return (
    <PlatformFeedListMetaRow
      feedSync={{ syncMeta, syncing, onSyncNow }}
      placement="above"
      className="border-b-0 pb-0"
    />
  );
}
