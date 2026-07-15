"use client";

import {
  DashboardCompactList,
  DashboardCompactListItem,
} from "@/components/dashboard/dashboard-compact-list";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import type { DashboardMessageUnreadRow } from "@/lib/contact-messages/messages-unread-summary";
import {
  formatRestaurantDateTime,
  isSameRestaurantCalendarDay,
} from "@/lib/restaurant/restaurant-timezone";

function formatMessageWhen(iso: string, timeZone: string): string {
  if (isSameRestaurantCalendarDay(iso, new Date(), timeZone)) {
    return formatRestaurantDateTime(iso, timeZone, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return formatRestaurantDateTime(iso, timeZone, {
    day: "2-digit",
    month: "short",
  });
}

export function DashboardMessagesListSheet({
  open,
  onOpenChange,
  rows,
  totalUnread,
  timeZone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: DashboardMessageUnreadRow[];
  totalUnread: number;
  timeZone: string;
}) {
  const empty = totalUnread === 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className={drawerContentClassName("compact")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Nachrichten
          </DrawerTitle>
          <DrawerDescription>
            {empty ? "Keine ungelesenen Nachrichten" : `${totalUnread} ungelesen`}
          </DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName(6)}>
          {empty ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Keine ungelesenen Nachrichten.
            </p>
          ) : (
            <DashboardCompactList aria-label="Ungelesene Nachrichten">
              {rows.map((row) => (
                <DashboardCompactListItem
                  key={row.contactId}
                  href={row.href}
                  title={row.contactName}
                  meta={row.preview}
                  stripeVariant="attention"
                  trailing={
                    <span className="tabular-nums">
                      {row.unreadCount > 1
                        ? `${row.unreadCount} · ${formatMessageWhen(row.lastAt, timeZone)}`
                        : formatMessageWhen(row.lastAt, timeZone)}
                    </span>
                  }
                  className="py-2.5"
                />
              ))}
            </DashboardCompactList>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
