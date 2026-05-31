"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ContactMessagePlatformIcon } from "@/components/contacts/contact-message-platform-chip";
import {
  groupContactMessageBubbles,
  platformsForBubbleGroup,
  primaryMessageForGroup,
} from "@/lib/contact-messages/group-message-bubbles";
import {
  ContactMessageReactions,
  useMessageReactionLongPress,
} from "@/components/contacts/contact-message-reactions";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";
import { cn } from "@/lib/utils";

export type ContactMessageWahaReactionsConfig = {
  restaurantId: string;
  onReactionChange?: () => void;
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContactMessageBubbleList({
  messages,
  className,
  onReservationOpen,
  wahaReactions,
}: {
  messages: ContactMessageRow[];
  className?: string;
  /** Reservierung im Drawer öffnen statt zur Übersicht navigieren. */
  onReservationOpen?: (reservationId: string) => void;
  /** WhatsApp (WAHA): Reactions anzeigen und setzen. */
  wahaReactions?: ContactMessageWahaReactionsConfig;
}) {
  if (messages.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Noch keine Nachrichten in diesem Verlauf.
      </p>
    );
  }

  const groups = groupContactMessageBubbles(messages);
  const [openReactionMessageId, setOpenReactionMessageId] = useState<
    string | null
  >(null);

  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {groups.map((group) => {
        const primary = primaryMessageForGroup(group);
        const platforms = platformsForBubbleGroup(group);
        const outbound = primary.direction === "outbound";
        const key =
          group.kind === "single"
            ? primary.id
            : `batch-${primary.send_batch_id}`;
        const reactionMessageId = primary.waha_message_id ?? primary.id;
        const showReactions = Boolean(
          wahaReactions && primary.waha_message_id,
        );

        return (
          <MessageBubbleRow
            key={key}
            primary={primary}
            platforms={platforms}
            outbound={outbound}
            showReactions={showReactions}
            wahaReactions={wahaReactions}
            reactionMessageId={reactionMessageId}
            pickerOpen={openReactionMessageId === reactionMessageId}
            onPickerOpenChange={(open) =>
              setOpenReactionMessageId(open ? reactionMessageId : null)
            }
            onReservationOpen={onReservationOpen}
          />
        );
      })}
    </ul>
  );
}

function MessageBubbleRow({
  primary,
  platforms,
  outbound,
  showReactions,
  wahaReactions,
  reactionMessageId,
  pickerOpen,
  onPickerOpenChange,
  onReservationOpen,
}: {
  primary: ContactMessageRow;
  platforms: ReturnType<typeof platformsForBubbleGroup>;
  outbound: boolean;
  showReactions: boolean;
  wahaReactions?: ContactMessageWahaReactionsConfig;
  reactionMessageId: string;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  onReservationOpen?: (reservationId: string) => void;
}) {
  const longPress = useMessageReactionLongPress(() => onPickerOpenChange(true));

  return (
    <li
      className={cn(
        "flex flex-col gap-1",
        outbound ? "items-end" : "items-start",
      )}
    >
      <div className="group/bubble relative max-w-[min(100%,20rem)]">
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm shadow-sm",
            outbound
              ? "rounded-br-md bg-accent text-accent-foreground"
              : "rounded-bl-md border border-border/50 bg-muted/40 text-foreground",
          )}
          {...(showReactions ? longPress : {})}
        >
          <p className="whitespace-pre-wrap break-words">{primary.body}</p>
        </div>
        {showReactions && wahaReactions && primary.waha_message_id ? (
          <ContactMessageReactions
            reactions={primary.reactions}
            wahaMessageId={primary.waha_message_id}
            restaurantId={wahaReactions.restaurantId}
            outbound={outbound}
            onUpdated={wahaReactions.onReactionChange}
            pickerOpen={pickerOpen}
            onPickerOpenChange={onPickerOpenChange}
            className="px-0.5"
          />
        ) : null}
      </div>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 px-1 text-[10px] text-muted-foreground",
          outbound && "justify-end",
        )}
      >
        {platforms.map((p) => (
          <ContactMessagePlatformIcon key={p} platform={p} variant="meta" />
        ))}
        <span>{formatWhen(primary.created_at)}</span>
        {primary.reservation_id ? (
          onReservationOpen ? (
            <Badge
              variant="outline"
              className="h-5 cursor-pointer gap-0.5 px-1.5 text-[10px] font-normal hover:bg-muted/60"
              render={
                <button
                  type="button"
                  onClick={() =>
                    onReservationOpen(primary.reservation_id!)
                  }
                />
              }
            >
              <CalendarDays className="size-3" aria-hidden />
              Reservierung
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="h-5 gap-0.5 px-1.5 text-[10px] font-normal"
              render={
                <Link
                  href={`/reservierungen/uebersicht?reservation=${primary.reservation_id}`}
                  prefetch
                />
              }
            >
              <CalendarDays className="size-3" aria-hidden />
              Reservierung
            </Badge>
          )
        ) : null}
      </div>
    </li>
  );
}
