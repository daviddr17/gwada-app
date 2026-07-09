"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, MessageSquare, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import type { ContactDetail } from "@/lib/supabase/contacts-db";
import {
  fetchContactTimeline,
  type ContactTimelineEntry,
} from "@/lib/supabase/contact-timeline-db";

function formatTimelineWhen(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TimelineIcon({ entry }: { entry: ContactTimelineEntry }) {
  if (entry.kind === "reservation") {
    return <CalendarDays className="size-4 shrink-0 text-muted-foreground" />;
  }
  if (entry.kind === "message") {
    return <MessageSquare className="size-4 shrink-0 text-muted-foreground" />;
  }
  return <StickyNote className="size-4 shrink-0 text-muted-foreground" />;
}

export function ContactTimelineSection({
  restaurantId,
  contact,
  refreshKey = 0,
}: {
  restaurantId: string;
  contact: ContactDetail;
  refreshKey?: number;
}) {
  const [entries, setEntries] = useState<ContactTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchContactTimeline({
      restaurantId,
      contact,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    setEntries(data);
  }, [restaurantId, contact, refreshKey]);

  useEffect(() => {
    void load();
  }, [load]);

  if (showSkeleton) {
    return (
      <div className="space-y-2" aria-busy>
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
        <Skeleton className="h-14 w-full rounded-lg" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Noch keine Aktivitäten — Reservierungen, Nachrichten und Notizen erscheinen
        hier chronologisch.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex gap-3 rounded-lg border border-border/40 bg-muted/15 px-3 py-2.5 text-sm"
        >
          <div className="mt-0.5">
            <TimelineIcon entry={entry} />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{entry.title}</p>
              <time
                className="shrink-0 text-[11px] text-muted-foreground tabular-nums"
                dateTime={entry.at}
              >
                {formatTimelineWhen(entry.at)}
              </time>
            </div>
            {entry.subtitle ? (
              <p className="text-xs text-muted-foreground">{entry.subtitle}</p>
            ) : null}
            {entry.body ? (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                {entry.body}
              </p>
            ) : null}
            {entry.kind === "reservation" && entry.reservationId ? (
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  render={
                    <Link
                      href={`/dashboard/reservierungen/uebersicht?reservation=${entry.reservationId}`}
                      prefetch
                    />
                  }
                >
                  Reservierung öffnen
                </Button>
              </div>
            ) : null}
            {entry.kind === "message" && entry.reservationId ? (
              <p className="text-[10px] text-muted-foreground">
                Verknüpft mit Reservierung
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
