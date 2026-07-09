"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, Filter, MessageSquare, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContactTimelineFilterDrawer } from "@/components/contacts/contact-timeline-filter-drawer";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import {
  countContactTimelineActiveFilters,
  DEFAULT_CONTACT_TIMELINE_FILTER,
  filterContactTimelineEntries,
  type ContactTimelineFilter,
} from "@/lib/constants/contact-timeline-filter";
import type { ContactDetail } from "@/lib/supabase/contacts-db";
import {
  fetchContactTimeline,
  type ContactTimelineEntry,
} from "@/lib/supabase/contact-timeline-db";
import { drawerFormSectionTitleClassName } from "@/lib/ui/drawer-form-section";
import {
  moduleSearchFilterActiveBadgeClassName,
  moduleSearchFilterButtonWrapClassName,
} from "@/lib/ui/module-search-filter-toolbar";

function formatTimelineWhen(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLastContactDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

type ContactTimelineStats = {
  reservations: number;
  messages: number;
  notes: number;
  lastContactAt: string | null;
};

function computeContactTimelineStats(
  entries: ContactTimelineEntry[],
  contact: Pick<ContactDetail, "last_interaction_at">,
): ContactTimelineStats {
  let reservations = 0;
  let messages = 0;
  let notes = 0;
  let lastContactAt = contact.last_interaction_at;

  for (const entry of entries) {
    if (entry.kind === "reservation") reservations += 1;
    else if (entry.kind === "message") messages += 1;
    else if (entry.kind === "note" || entry.kind === "legacy_note") notes += 1;

    if (
      !lastContactAt ||
      new Date(entry.at).getTime() > new Date(lastContactAt).getTime()
    ) {
      lastContactAt = entry.at;
    }
  }

  return { reservations, messages, notes, lastContactAt };
}

function ContactTimelineStatTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-[4.75rem] flex-1 rounded-lg border border-border/40 bg-muted/15 px-3 py-2">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}

function ContactTimelineStatsRow({ stats }: { stats: ContactTimelineStats }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ContactTimelineStatTile
        label="Reservierungen"
        value={String(stats.reservations)}
      />
      <ContactTimelineStatTile
        label="Nachrichten"
        value={String(stats.messages)}
      />
      <ContactTimelineStatTile label="Notizen" value={String(stats.notes)} />
      <ContactTimelineStatTile
        label="Letzter Kontakt"
        value={formatLastContactDate(stats.lastContactAt)}
      />
    </div>
  );
}

function ContactTimelineStatsSkeleton() {
  return (
    <div className="flex flex-wrap gap-2" aria-hidden>
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-14 min-w-[4.75rem] flex-1 rounded-lg" />
      ))}
    </div>
  );
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
  stackZClass,
}: {
  restaurantId: string;
  contact: ContactDetail;
  refreshKey?: number;
  /** Z-Index für verschachteltes Filter-Sheet über dem Kontakt-Drawer. */
  stackZClass?: string;
}) {
  const [entries, setEntries] = useState<ContactTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<ContactTimelineFilter>(
    DEFAULT_CONTACT_TIMELINE_FILTER,
  );
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

  const activeFilterCount = countContactTimelineActiveFilters(filter);
  const filteredEntries = useMemo(
    () => filterContactTimelineEntries(entries, filter),
    [entries, filter],
  );
  const stats = useMemo(
    () => computeContactTimelineStats(entries, contact),
    [entries, contact],
  );

  const filterButton = (
    <div className={moduleSearchFilterButtonWrapClassName}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="shrink-0 rounded-full border-border/60"
        onClick={() => setFilterOpen(true)}
        aria-label="Aktivitäten filtern"
      >
        <Filter className="size-4" />
      </Button>
      {activeFilterCount > 0 ? (
        <Badge
          variant="secondary"
          className={moduleSearchFilterActiveBadgeClassName}
        >
          {activeFilterCount}
        </Badge>
      ) : null}
    </div>
  );

  const sectionHeader = (
    <div className="flex items-center justify-between gap-2">
      <h3 className={drawerFormSectionTitleClassName}>Aktivitäten</h3>
      {filterButton}
    </div>
  );

  if (showSkeleton) {
    return (
      <>
        <div className="space-y-4" aria-busy>
          {sectionHeader}
          <ContactTimelineStatsSkeleton />
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        </div>
        <ContactTimelineFilterDrawer
          open={filterOpen}
          onOpenChange={setFilterOpen}
          filter={filter}
          onFilterChange={setFilter}
          stackZClass={stackZClass}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {sectionHeader}
        <ContactTimelineStatsRow stats={stats} />

        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Noch keine Aktivitäten — Reservierungen, Nachrichten und Notizen erscheinen
            hier chronologisch.
          </p>
        ) : filteredEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Keine Aktivitäten für die aktiven Filter.
          </p>
        ) : (
          <ul className="space-y-2">
            {filteredEntries.map((entry) => (
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
        )}
      </div>

      <ContactTimelineFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filter={filter}
        onFilterChange={setFilter}
        stackZClass={stackZClass}
      />
    </>
  );
}
