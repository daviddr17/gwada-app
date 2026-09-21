"use client";

import { useCallback, useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  InboxFollowUpSheet,
  type InboxFollowUpSheetValues,
} from "@/components/contacts/inbox-follow-up-sheet";
import {
  DashboardCompactInlineMetrics,
  DashboardCompactList,
  DashboardCompactListItem,
  DashboardCompactMetricPill,
  DashboardMessagesTileSkeleton,
} from "@/components/dashboard/dashboard-compact-list";
import { DashboardMessageQuickActions } from "@/components/dashboard/dashboard-message-quick-actions";
import { DashboardWidgetShell } from "@/components/dashboard/dashboard-widget-shell";
import {
  clearConversationFollowUpClient,
  upsertConversationFollowUpClient,
} from "@/lib/contact-messages/fetch-inbox-client";
import { useDashboardMessagesStats } from "@/lib/hooks/use-dashboard-messages-stats";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantIanaTimezone } from "@/lib/hooks/use-restaurant-iana-timezone";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { dashboardMessagesInboxHref } from "@/lib/contact-messages/messages-unread-summary";
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

export function DashboardMessagesTile() {
  const { restaurantId } = useWorkspaceRestaurantUuid();
  const restaurantTimeZone = useRestaurantIanaTimezone(restaurantId);
  const { summary, error, loading, ready } = useDashboardMessagesStats();
  const showSkeleton = useDeferredSkeleton(!ready || (loading && !summary));
  const total = summary?.total_unread ?? 0;
  const [followUpTarget, setFollowUpTarget] = useState<FollowUpTarget | null>(
    null,
  );
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  const saveFollowUp = useCallback(
    async (values: InboxFollowUpSheetValues) => {
      if (!restaurantId || !followUpTarget) return;
      setSavingFollowUp(true);
      const { ok, error: saveError } = await upsertConversationFollowUpClient({
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
        toast.error(saveError ?? "Später konnte nicht gespeichert werden.");
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
    const { ok, error: clearError } = await clearConversationFollowUpClient({
      restaurantId,
      conversationKey: followUpTarget.conversationKey,
    });
    setSavingFollowUp(false);
    if (!ok) {
      toast.error(clearError ?? "Konnte nicht erledigt werden.");
      return;
    }
    toast.success("Später erledigt.");
    setFollowUpTarget(null);
  }, [restaurantId, followUpTarget]);

  return (
    <>
      <DashboardWidgetShell
        title="Nachrichten"
        staticChrome
        loadingContent={<DashboardMessagesTileSkeleton />}
        icon={
          <MessageCircle
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        }
        href="/dashboard/kontakte/nachrichten?platform=all"
        linkLabel="Zu Nachrichten"
        ready={ready}
        loading={showSkeleton}
        error={error}
      >
        {summary ? (
          <div className="space-y-3">
            <DashboardCompactInlineMetrics>
              <DashboardCompactMetricPill
                label="Ungelesen"
                value={String(total)}
                href={
                  total > 0
                    ? dashboardMessagesInboxHref({ read: "unread" })
                    : undefined
                }
                highlight={total > 0}
                stripeVariant="attention"
              />
            </DashboardCompactInlineMetrics>

            {summary.unread.length > 0 ? (
              <DashboardCompactList>
                {summary.unread.map((row) => (
                  <DashboardCompactListItem
                    key={row.contactId}
                    href={row.href}
                    title={row.contactName}
                    meta={row.preview}
                    stripeVariant="attention"
                    trailing={
                      <span className="tabular-nums">
                        {row.unreadCount > 1
                          ? `${row.unreadCount} · ${formatMessageWhen(row.lastAt, restaurantTimeZone)}`
                          : formatMessageWhen(row.lastAt, restaurantTimeZone)}
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
                  />
                ))}
              </DashboardCompactList>
            ) : (
              <p className="text-xs text-muted-foreground">
                Keine ungelesenen Nachrichten.
              </p>
            )}
          </div>
        ) : null}
      </DashboardWidgetShell>

      <InboxFollowUpSheet
        open={followUpTarget != null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setFollowUpTarget(null);
        }}
        restaurantId={restaurantId}
        contactDisplayName={followUpTarget?.displayName ?? ""}
        saving={savingFollowUp}
        onSave={saveFollowUp}
        onClear={clearFollowUp}
      />
    </>
  );
}
