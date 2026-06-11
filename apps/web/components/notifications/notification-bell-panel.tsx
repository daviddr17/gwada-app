"use client";

import Link from "next/link";
import { Check, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NOTIFICATION_MODULES } from "@/lib/notifications/notification-modules";
import type { NotificationModuleId } from "@/lib/notifications/notification-modules";
import type { NotificationSummary } from "@/lib/notifications/notification-types";
import { cn } from "@/lib/utils";

function formatNotificationWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) {
    return d.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
  });
}

type NotificationBellPanelProps = {
  summary: NotificationSummary | null;
  loading: boolean;
  onMarkRead: (params: {
    module: NotificationModuleId;
    itemId: string;
    meta?: Record<string, string>;
  }) => Promise<unknown>;
  onNavigate?: () => void;
};

export function NotificationBellPanel({
  summary,
  loading,
  onMarkRead,
  onNavigate,
}: NotificationBellPanelProps) {
  const hasItems = (summary?.totalCount ?? 0) > 0;

  return (
    <div className="flex w-[min(100vw-1.5rem,22rem)] flex-col">
      <div className="border-b border-border/50 px-4 py-3">
        <p className="text-sm font-semibold text-foreground">Benachrichtigungen</p>
        {!loading && !hasItems ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Alles gelesen — keine neuen Hinweise.
          </p>
        ) : null}
      </div>

      <div
        className={cn(
          "max-h-[min(70vh,24rem)] overflow-y-auto overscroll-contain",
          loading && !summary ? "min-h-[6rem]" : "",
        )}
      >
        {summary?.modules.map((mod) => {
          const def = NOTIFICATION_MODULES[mod.id];
          const Icon = def.icon;
          return (
            <section key={mod.id} className="border-b border-border/40 last:border-b-0">
              <div className="flex items-center justify-between gap-2 px-4 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate text-xs font-medium text-muted-foreground">
                    {mod.label}
                  </span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground">
                    {mod.count}
                  </span>
                </div>
                <Link
                  href={mod.href}
                  className="shrink-0 text-xs font-medium text-foreground/80 underline-offset-2 hover:underline"
                  onClick={onNavigate}
                >
                  Alle
                </Link>
              </div>
              <ul className="list-none space-y-0.5 px-2 pb-2">
                {mod.items.map((item) => (
                  <li key={`${mod.id}:${item.id}`}>
                    <div className="group flex items-stretch gap-1 rounded-xl hover:bg-muted/50">
                      <Link
                        href={item.href}
                        className="flex min-w-0 flex-1 items-start gap-2 px-2 py-2"
                        onClick={onNavigate}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium leading-snug text-foreground">
                            {item.title}
                          </p>
                          {item.subtitle ? (
                            <p className="line-clamp-2 text-xs text-muted-foreground">
                              {item.subtitle}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 pt-0.5 text-[10px] tabular-nums text-muted-foreground">
                          {formatNotificationWhen(item.at)}
                        </span>
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="my-1 me-1 shrink-0 rounded-full text-muted-foreground opacity-70 hover:text-foreground group-hover:opacity-100"
                        aria-label="Als gelesen markieren"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void onMarkRead({
                            module: mod.id,
                            itemId: item.id,
                            meta: item.meta,
                          });
                        }}
                      >
                        <Check className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="border-t border-border/50 p-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-full justify-start gap-2 rounded-xl text-sm font-medium"
          render={<Link href="/settings/benachrichtigungen" onClick={onNavigate} />}
        >
          <Settings className="size-4 text-muted-foreground" />
          Benachrichtigungen einstellen
        </Button>
      </div>
    </div>
  );
}
