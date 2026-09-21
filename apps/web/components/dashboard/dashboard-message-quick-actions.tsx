"use client";

import { useState } from "react";
import { Bookmark, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markConversationReadClient } from "@/lib/contact-messages/fetch-inbox-client";
import { invalidateMessagesInboxAfterMarkRead } from "@/lib/contact-messages/invalidate-messages-inbox-cache-client";
import { patchUnifiedInboxCacheConversation } from "@/lib/contact-messages/unified-inbox-cache";
import { dispatchDashboardMessagesRefresh } from "@/lib/dashboard/dashboard-live-events";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import { cn } from "@/lib/utils";

function markReadErrorMessage(error: string): string {
  switch (error) {
    case "no_contact_email":
      return "Für diesen Chat ist keine E-Mail-Adresse hinterlegt.";
    case "imap_not_configured":
      return "E-Mail-Konto ist nicht verbunden.";
    default:
      return `Als gelesen markieren: ${error}`;
  }
}

/** Schnell-Aktionen für ungelesene Nachrichten (Dashboard Heute / Kachel). */
export function DashboardMessageQuickActions({
  restaurantId,
  contactId,
  platform,
  unreadCount,
  className,
  onOpenFollowUp,
}: {
  restaurantId: string;
  contactId: string;
  platform: ContactMessagePlatform;
  unreadCount: number;
  className?: string;
  onOpenFollowUp: () => void;
}) {
  const [optimisticRead, setOptimisticRead] = useState(false);
  const [busy, setBusy] = useState(false);

  if (optimisticRead) {
    return (
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
          className,
        )}
        aria-label="Als gelesen markiert"
        title="Gelesen"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Check className="size-4" aria-hidden />
        )}
      </span>
    );
  }

  return (
    <div className={cn("flex shrink-0 items-center gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={busy || !restaurantId}
        className="size-9 shrink-0 rounded-full border-border/60 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        aria-label="Später erledigen"
        title="Später"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (busy || !restaurantId) return;
          onOpenFollowUp();
        }}
      >
        <Bookmark className="size-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={busy || !restaurantId}
        className="size-9 shrink-0 rounded-full border-emerald-500/50 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
        aria-label="Als gelesen markieren"
        title="Gelesen"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (busy || !restaurantId) return;

          setOptimisticRead(true);
          setBusy(true);
          invalidateMessagesInboxAfterMarkRead({
            restaurantId,
            contactId,
          });

          void (async () => {
            try {
              const result = await markConversationReadClient({
                restaurantId,
                conversationKey: contactId,
                platform,
              });
              if (!result.ok) {
                setOptimisticRead(false);
                patchUnifiedInboxCacheConversation(restaurantId, contactId, {
                  is_unread: true,
                  unread_count: Math.max(1, unreadCount),
                  unread_hint: "channel",
                });
                dispatchDashboardMessagesRefresh({
                  restaurantId,
                  contactId,
                });
                toast.error(
                  markReadErrorMessage(result.error ?? "unknown_error"),
                );
                return;
              }
            } catch {
              setOptimisticRead(false);
              patchUnifiedInboxCacheConversation(restaurantId, contactId, {
                is_unread: true,
                unread_count: Math.max(1, unreadCount),
                unread_hint: "channel",
              });
              dispatchDashboardMessagesRefresh({
                restaurantId,
                contactId,
              });
              toast.error("Als gelesen markieren fehlgeschlagen.");
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <Check className="size-4" />
      </Button>
    </div>
  );
}
