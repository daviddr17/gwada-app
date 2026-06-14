"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { SkeletonCardFrame } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useNotificationPushHistory } from "@/lib/hooks/use-notification-push-history";
import {
  formatUserPushHistoryWhen,
  type UserNotificationPushHistoryRow,
} from "@/lib/notifications/user-notification-push-history";
import { cn } from "@/lib/utils";

function PushHistoryTable({
  rows,
  className,
}: {
  rows: UserNotificationPushHistoryRow[];
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/50 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <th className="px-2 py-2 font-medium">Datum</th>
            <th className="px-2 py-2 font-medium">Ereignis</th>
            <th className="px-2 py-2 font-medium">Kanal</th>
            <th className="px-2 py-2 font-medium">Inhalt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-border/30 align-top last:border-b-0"
            >
              <td className="px-2 py-3 whitespace-nowrap tabular-nums text-muted-foreground">
                {formatUserPushHistoryWhen(row.occurredAt)}
              </td>
              <td className="px-2 py-3 whitespace-nowrap font-medium text-foreground">
                {row.eventLabel}
              </td>
              <td className="px-2 py-3 whitespace-nowrap text-foreground">
                {row.channelLabel}
              </td>
              <td
                className={cn(
                  "max-w-[16rem] px-2 py-3 text-foreground",
                  row.status === "failed" && "text-destructive",
                )}
              >
                {row.content}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PushHistoryPreviewSkeleton() {
  return (
    <SkeletonCardFrame className="space-y-3 p-6">
      <div className="skeleton-shimmer h-6 w-40 rounded-md bg-muted" />
      <div className="skeleton-shimmer h-4 w-full max-w-md rounded-md bg-muted" />
      <div className="skeleton-shimmer h-24 rounded-xl bg-muted" />
    </SkeletonCardFrame>
  );
}

export function NotificationPushHistorySection() {
  const {
    ready,
    previewRows,
    totalCount,
    isLoading,
    loadHistory,
    previewLimit,
  } = useNotificationPushHistory();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState<UserNotificationPushHistoryRow[]>(
    [],
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const showSkeleton = useDeferredSkeleton(isLoading);

  useEffect(() => {
    if (!drawerOpen || !ready) return;
    setHistoryLoading(true);
    void loadHistory().then((result) => {
      setHistoryRows(result.rows);
      setHistoryLoading(false);
    });
  }, [drawerOpen, ready, loadHistory]);

  if (!ready) return null;

  if (isLoading && showSkeleton) {
    return <PushHistoryPreviewSkeleton />;
  }

  if (isLoading && !showSkeleton) {
    return <div className="min-h-[8rem]" aria-busy="true" />;
  }

  const hasMore = totalCount > previewLimit;

  return (
    <>
      <Card className="border-border/50 shadow-card">
        <CardHeader className="gap-2">
          <CardTitle className="text-xl">Push-Verlauf</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            Zuletzt zugestellte Push-Benachrichtigungen für dieses Restaurant
            (WhatsApp und E-Mail).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {previewRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Push-Zustellungen protokolliert.
            </p>
          ) : (
            <>
              <PushHistoryTable rows={previewRows} />
              {hasMore ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-xl"
                  onClick={() => setDrawerOpen(true)}
                >
                  Mehr anzeigen ({totalCount})
                </Button>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className="mx-auto flex max-h-[min(92dvh,640px)] max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
          <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
            <DrawerTitle className="text-xl font-semibold tracking-tight">
              Push-Verlauf
            </DrawerTitle>
            <DrawerDescription className="text-base">
              Alle protokollierten Zustellungen für dieses Restaurant.
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
            {historyLoading ? (
              <div className="space-y-2 px-2 py-4" aria-busy="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="skeleton-shimmer h-12 rounded-xl bg-muted"
                  />
                ))}
              </div>
            ) : historyRows.length === 0 ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">
                Keine Einträge.
              </p>
            ) : (
              <PushHistoryTable rows={historyRows} />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
