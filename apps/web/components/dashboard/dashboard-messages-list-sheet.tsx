"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  InboxFollowUpSheet,
  type InboxFollowUpSheetValues,
} from "@/components/contacts/inbox-follow-up-sheet";
import {
  DashboardCompactList,
  DashboardCompactListItem,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardMessageQuickActions } from "@/components/dashboard/dashboard-message-quick-actions";
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
  clearConversationFollowUpClient,
  upsertConversationFollowUpClient,
} from "@/lib/contact-messages/fetch-inbox-client";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
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

type FollowUpTarget = {
  conversationKey: string;
  displayName: string;
};

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
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const empty = totalUnread === 0;
  const [followUpTarget, setFollowUpTarget] = useState<FollowUpTarget | null>(
    null,
  );
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  const saveFollowUp = useCallback(
    async (values: InboxFollowUpSheetValues) => {
      if (!restaurantId || !followUpTarget) return;
      setSavingFollowUp(true);
      const { ok, error } = await upsertConversationFollowUpClient({
        restaurantId,
        conversationKey: followUpTarget.conversationKey,
        contactDisplayName: followUpTarget.displayName,
        reason: values.reason,
        remindAt: values.remindAt,
        staffId: values.staffId,
        notifyWhatsapp: values.notifyWhatsapp,
        notifyEmail: values.notifyEmail,
      });
      setSavingFollowUp(false);
      if (!ok) {
        toast.error(error ?? "Später konnte nicht gespeichert werden.");
        return;
      }
      toast.success(
        values.staffId
          ? "Als Später markiert — Todo für Mitarbeiter angelegt."
          : "Als Später markiert.",
      );
      setFollowUpTarget(null);
    },
    [restaurantId, followUpTarget],
  );

  const clearFollowUp = useCallback(async () => {
    if (!restaurantId || !followUpTarget) return;
    setSavingFollowUp(true);
    const { ok, error } = await clearConversationFollowUpClient({
      restaurantId,
      conversationKey: followUpTarget.conversationKey,
    });
    setSavingFollowUp(false);
    if (!ok) {
      toast.error(error ?? "Konnte nicht erledigt werden.");
      return;
    }
    toast.success("Später erledigt.");
    setFollowUpTarget(null);
  }, [restaurantId, followUpTarget]);

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
        <DrawerContent className={drawerContentClassName("compact")}>
          <DrawerHeader className={drawerFormHeaderClassName(6)}>
            <DrawerTitle className="text-xl font-semibold tracking-tight">
              Nachrichten
            </DrawerTitle>
            <DrawerDescription>
              {empty
                ? "Keine ungelesenen Nachrichten"
                : `${totalUnread} ungelesen`}
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
                    trailingAction={
                      restaurantId ? (
                        <DashboardMessageQuickActions
                          restaurantId={restaurantId}
                          contactId={row.contactId}
                          platform={row.platform}
                          unreadCount={row.unreadCount}
                          onOpenFollowUp={() =>
                            setFollowUpTarget({
                              conversationKey: row.contactId,
                              displayName: row.contactName,
                            })
                          }
                        />
                      ) : null
                    }
                    className="py-2.5"
                  />
                ))}
              </DashboardCompactList>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <InboxFollowUpSheet
        open={followUpTarget != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setFollowUpTarget(null);
        }}
        restaurantId={restaurantId}
        contactDisplayName={followUpTarget?.displayName ?? ""}
        saving={savingFollowUp}
        stackAboveInboxOverlay
        onSave={saveFollowUp}
        onClear={clearFollowUp}
      />
    </>
  );
}
