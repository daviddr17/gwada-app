"use client";

import { useEffect, useState } from "react";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
  loadStaffActivityTimeline,
  type StaffActivityItem,
} from "@/lib/staff/staff-activity-timeline";

const whenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function StaffActivitySection({
  restaurantId,
  staffId,
  profileId,
}: {
  restaurantId: string;
  staffId: string;
  profileId: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<StaffActivityItem[]>([]);
  const showSkeleton = useDeferredSkeleton(loading);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadStaffActivityTimeline({ restaurantId, staffId, profileId }).then(
      (next) => {
        if (cancelled) return;
        setItems(next);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [restaurantId, staffId, profileId]);

  return (
    <DrawerFormSection title="Aktivität" contentPadding={5}>
      {showSkeleton ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : loading ? (
        <div className="min-h-16" aria-busy="true" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Aktivität für diese Person.
        </p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-border/40 bg-muted/15 p-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="border-b border-border/30 pb-2 text-sm last:border-0 last:pb-0"
            >
              <p className="font-medium">
                {item.area}
                {" · "}
                {item.title}
                {" · "}
                <span className="font-normal text-muted-foreground">
                  {whenFmt.format(new Date(item.at))}
                </span>
              </p>
              {item.detail && item.detail !== item.title ? (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {item.detail}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </DrawerFormSection>
  );
}
