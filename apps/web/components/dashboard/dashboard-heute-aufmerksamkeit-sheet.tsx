"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  InboxFollowUpSheet,
  type InboxFollowUpSheetValues,
} from "@/components/contacts/inbox-follow-up-sheet";
import { DashboardReservationQuickAcceptButton } from "@/components/dashboard/dashboard-reservation-quick-accept-button";
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
import {
  clearConversationFollowUpClient,
  upsertConversationFollowUpClient,
} from "@/lib/contact-messages/fetch-inbox-client";
import { formatReservationTimeInRestaurantTz } from "@/lib/restaurant/restaurant-timezone";
import type { DashboardMessageUnreadRow } from "@/lib/contact-messages/messages-unread-summary";
import type { DashboardReservationRecent } from "@/lib/reservations/compute-dashboard-reservation-summary";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";

type FollowUpTarget = {
  conversationKey: string;
  displayName: string;
};

export function DashboardHeuteAufmerksamkeitSheet({
  open,
  onOpenChange,
  unconfirmedReservations,
  unreadMessages,
  unconfirmedCount,
  unreadMessageCount,
  timeZone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unconfirmedReservations: DashboardReservationRecent[];
  unreadMessages: DashboardMessageUnreadRow[];
  unconfirmedCount: number;
  unreadMessageCount: number;
  timeZone: string;
}) {
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const total = unconfirmedCount + unreadMessageCount;
  const empty = total === 0;
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
              Aufmerksamkeit
            </DrawerTitle>
            <DrawerDescription>
              {empty
                ? "Keine Auffälligkeiten"
                : [
                    unconfirmedCount > 0
                      ? `${unconfirmedCount} unbestätigt`
                      : null,
                    unreadMessageCount > 0
                      ? `${unreadMessageCount} ungelesen`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </DrawerDescription>
          </DrawerHeader>
          <div className={drawerScrollAreaClassName(6)}>
            {empty ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Keine Auffälligkeiten
              </p>
            ) : (
              <div className="space-y-4">
                {unconfirmedReservations.length > 0 ? (
                  <section className="space-y-2">
                    <h3 className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Unbestätigte Reservierungen
                    </h3>
                    <DashboardCompactList aria-label="Unbestätigte Reservierungen">
                      {unconfirmedReservations.map((row) => (
                        <DashboardCompactListItem
                          key={row.id}
                          href={row.href}
                          title={row.guestLabel}
                          meta={`${row.partySize} P.`}
                          trailing={formatReservationTimeInRestaurantTz(
                            row.startsAt,
                            timeZone,
                          )}
                          trailingAction={
                            restaurantId ? (
                              <DashboardReservationQuickAcceptButton
                                restaurantId={restaurantId}
                                reservationId={row.id}
                                statusCode={row.statusCode}
                              />
                            ) : null
                          }
                          stripeVariant="attention"
                          className="py-2.5"
                        />
                      ))}
                    </DashboardCompactList>
                  </section>
                ) : null}

                {unreadMessages.length > 0 ? (
                  <section className="space-y-2">
                    <h3 className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Ungelesene Nachrichten
                    </h3>
                    <DashboardCompactList aria-label="Ungelesene Nachrichten">
                      {unreadMessages.map((row) => (
                        <DashboardCompactListItem
                          key={row.contactId}
                          href={row.href}
                          title={row.contactName}
                          meta={row.preview}
                          stripeVariant="attention"
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
                  </section>
                ) : null}
              </div>
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
