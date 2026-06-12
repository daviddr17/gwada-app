"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ContactMessagePlatformIcon } from "@/components/contacts/contact-message-platform-chip";
import { WhatsAppMessageAckMarks } from "@/components/contacts/whatsapp-message-ack-marks";
import {
  groupContactMessageBubbles,
  primaryMessageForGroup,
} from "@/lib/contact-messages/group-message-bubbles";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import {
  displayPlatformsForMessage,
  messageDisplayPlatform,
} from "@/lib/contact-messages/message-display-platform";
import {
  ContactMessageReactions,
  useMessageReactionLongPress,
} from "@/components/contacts/contact-message-reactions";
import { ContactMessageAttachments } from "@/components/contacts/contact-message-attachments";
import { ContactMessageEmailBody } from "@/components/contacts/contact-message-email-body";
import { deleteWahaMessageClient } from "@/lib/contact-messages/waha-typing-client";
import {
  isRedundantWhatsappMediaBody,
  isWahaEditableMessage,
  messageHasVisibleBubbleContent,
} from "@/lib/contact-messages/whatsapp-mirror-preview";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";
import { cn } from "@/lib/utils";

/** E-Mail-Bubbles: schmal bei kurzem Inhalt, maximal 60 % des Chatfensters. */
export const contactMessageEmailBubbleClassName = "w-fit max-w-[60%]";

export type ContactMessageWahaReactionsConfig = {
  restaurantId: string;
  chatId: string;
  onReactionChange?: () => void;
  onMessageDeleted?: () => void;
  onEditMessage?: (message: ContactMessageRow) => void;
  editingMessageId?: string | null;
  onOptimisticMessageDelete?: (message: ContactMessageRow) => void;
};

export type ContactMessageMetaReactionsConfig = {
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
  metaReactions,
}: {
  messages: ContactMessageRow[];
  className?: string;
  /** Reservierung im Drawer öffnen statt zur Übersicht navigieren. */
  onReservationOpen?: (reservationId: string) => void;
  /** WhatsApp (WAHA): Reactions anzeigen und setzen. */
  wahaReactions?: ContactMessageWahaReactionsConfig;
  /** Messenger / Instagram: Reactions anzeigen und setzen. */
  metaReactions?: ContactMessageMetaReactionsConfig;
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
      {groups.map((group, index) => {
        const primary = primaryMessageForGroup(group);
        if (!messageHasVisibleBubbleContent(primary)) return null;
        const platforms =
          group.kind === "single"
            ? displayPlatformsForMessage(primary)
            : [
                ...new Set(
                  group.messages.flatMap((m) => displayPlatformsForMessage(m)),
                ),
              ];
        const outbound = primary.direction === "outbound";
        const key =
          group.kind === "single"
            ? primary.id
            : `batch-${primary.send_batch_id ?? primary.id}-${index}`;
        const metaMessageId = primary.meta_message_id ?? null;
        const reactionMessageId =
          primary.waha_message_id ?? metaMessageId ?? primary.id;
        const metaPlatform =
          metaMessageId &&
          (messageDisplayPlatform(primary) === "facebook" ||
            messageDisplayPlatform(primary) === "instagram")
            ? messageDisplayPlatform(primary)
            : null;
        const showReactions = Boolean(
          (wahaReactions && primary.waha_message_id) ||
            (metaReactions && metaMessageId && metaPlatform),
        );

        const showDelete = Boolean(
          wahaReactions &&
            outbound &&
            primary.waha_message_id &&
            messageDisplayPlatform(primary) === "whatsapp",
        );
        const showEdit = Boolean(
          showDelete &&
            isWahaEditableMessage(primary) &&
            wahaReactions?.onEditMessage,
        );

        return (
          <MessageBubbleRow
            key={key}
            primary={primary}
            platforms={platforms}
            outbound={outbound}
            showReactions={showReactions}
            showDelete={showDelete}
            showEdit={showEdit}
            wahaReactions={wahaReactions}
            metaReactions={metaReactions}
            metaMessageId={metaMessageId}
            metaPlatform={
              metaPlatform === "facebook" || metaPlatform === "instagram"
                ? metaPlatform
                : null
            }
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
  showDelete,
  showEdit,
  wahaReactions,
  metaReactions,
  metaMessageId,
  metaPlatform,
  reactionMessageId,
  pickerOpen,
  onPickerOpenChange,
  onReservationOpen,
}: {
  primary: ContactMessageRow;
  platforms: ContactMessagePlatform[];
  outbound: boolean;
  showReactions: boolean;
  showDelete: boolean;
  showEdit: boolean;
  wahaReactions?: ContactMessageWahaReactionsConfig;
  metaReactions?: ContactMessageMetaReactionsConfig;
  metaMessageId: string | null;
  metaPlatform: "facebook" | "instagram" | null;
  reactionMessageId: string;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  onReservationOpen?: (reservationId: string) => void;
}) {
  const longPress = useMessageReactionLongPress(() => onPickerOpenChange(true));
  const isEmail = messageDisplayPlatform(primary) === "email";
  const hasHtmlBody = Boolean(primary.body_html?.trim());
  const showTextBody =
    Boolean(primary.body.trim()) &&
    !isRedundantWhatsappMediaBody(primary.body, primary.attachments);
  const hasBody = showTextBody || hasHtmlBody;
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!wahaReactions || !primary.waha_message_id || deleting) return;
    setDeleting(true);
    wahaReactions.onOptimisticMessageDelete?.(primary);
    const result = await deleteWahaMessageClient({
      restaurantId: wahaReactions.restaurantId,
      chatId: wahaReactions.chatId,
      messageId: primary.waha_message_id,
    });
    setDeleting(false);
    if (!result.ok) {
      toast.error("Nachricht konnte nicht gelöscht werden.");
      wahaReactions.onMessageDeleted?.();
      return;
    }
    toast.success("Nachricht gelöscht.");
    wahaReactions.onMessageDeleted?.();
  };

  return (
    <li
      className={cn(
        "flex flex-col gap-1",
        outbound ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "group/bubble relative min-w-0",
          isEmail
            ? contactMessageEmailBubbleClassName
            : "max-w-[min(100%,20rem)]",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm shadow-sm",
            outbound
              ? "rounded-br-md bg-accent text-accent-foreground"
              : "rounded-bl-md border border-border/50 bg-muted/40 text-foreground",
            isEmail && hasHtmlBody && "bg-background text-foreground",
            isEmail && hasHtmlBody && "overflow-visible",
          )}
          {...(showReactions ? longPress : {})}
        >
          {primary.attachments?.length ? (
            <ContactMessageAttachments
              attachments={primary.attachments}
              outbound={outbound}
              variant={isEmail ? "email" : "default"}
              className={hasBody ? "mb-2" : undefined}
            />
          ) : null}
          {isEmail ? (
            <ContactMessageEmailBody
              body={primary.body}
              bodyHtml={primary.body_html}
            />
          ) : showTextBody ? (
            <p className="whitespace-pre-wrap break-words">{primary.body}</p>
          ) : null}
        </div>
        {showReactions &&
        (wahaReactions?.restaurantId || metaReactions?.restaurantId) ? (
          <ContactMessageReactions
            reactions={primary.reactions}
            wahaMessageId={primary.waha_message_id ?? undefined}
            metaMessageId={metaMessageId ?? undefined}
            metaPlatform={metaPlatform ?? undefined}
            restaurantId={
              wahaReactions?.restaurantId ?? metaReactions!.restaurantId
            }
            outbound={outbound}
            onUpdated={
              wahaReactions?.onReactionChange ?? metaReactions?.onReactionChange
            }
            pickerOpen={pickerOpen}
            onPickerOpenChange={onPickerOpenChange}
            onDelete={showDelete ? () => handleDelete() : undefined}
            onEdit={
              showEdit && wahaReactions?.onEditMessage
                ? () => wahaReactions.onEditMessage!(primary)
                : undefined
            }
            deleting={deleting}
            editing={wahaReactions?.editingMessageId === primary.waha_message_id}
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
        {platforms.map((p, platformIndex) => (
          <ContactMessagePlatformIcon
            key={`${p}-${platformIndex}`}
            platform={p}
            variant="meta"
          />
        ))}
        <span>{formatWhen(primary.created_at)}</span>
        {messageDisplayPlatform(primary) === "whatsapp" ? (
          <WhatsAppMessageAckMarks
            ack={primary.waha_ack}
            outbound={outbound}
          />
        ) : null}
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
                  href={`/dashboard/reservierungen/uebersicht?reservation=${primary.reservation_id}`}
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
