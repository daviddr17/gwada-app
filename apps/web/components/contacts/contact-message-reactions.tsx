"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ContactMessageEmojiPickerSheet } from "@/components/contacts/contact-message-emoji-picker-sheet";
import { Button } from "@/components/ui/button";
import { triggerWahaReaction } from "@/lib/contact-messages/trigger-waha-reaction";
import type { ContactMessageReaction } from "@/lib/supabase/contact-messages-db";
import { cn } from "@/lib/utils";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
const LONG_PRESS_MS = 450;

export function useMessageReactionLongPress(onOpen: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(() => {
    clear();
    timerRef.current = setTimeout(onOpen, LONG_PRESS_MS);
  }, [clear, onOpen]);

  const onPointerEnd = useCallback(() => {
    clear();
  }, [clear]);

  return { onPointerDown, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onPointerLeave: onPointerEnd };
}

function groupReactionsForDisplay(reactions: ContactMessageReaction[]) {
  const groups = new Map<
    string,
    { emoji: string; count: number; includesMe: boolean }
  >();
  for (const r of reactions) {
    const existing = groups.get(r.emoji);
    if (existing) {
      existing.count += 1;
      existing.includesMe = existing.includesMe || r.fromMe;
    } else {
      groups.set(r.emoji, {
        emoji: r.emoji,
        count: 1,
        includesMe: r.fromMe,
      });
    }
  }
  return [...groups.values()];
}

export function ContactMessageReactions({
  reactions,
  wahaMessageId,
  restaurantId,
  outbound,
  onUpdated,
  pickerOpen,
  onPickerOpenChange,
  onDelete,
  onEdit,
  deleting,
  editing,
  className,
}: {
  reactions?: ContactMessageReaction[];
  wahaMessageId: string;
  restaurantId: string;
  outbound: boolean;
  onUpdated?: () => void;
  pickerOpen: boolean;
  onPickerOpenChange: (open: boolean) => void;
  onDelete?: () => void | Promise<void>;
  onEdit?: () => void;
  deleting?: boolean;
  editing?: boolean;
  className?: string;
}) {
  const [emojiSheetOpen, setEmojiSheetOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const list = reactions ?? [];
  const grouped = groupReactionsForDisplay(list);
  const myReaction = list.find((r) => r.fromMe);

  const closePicker = useCallback(
    () => onPickerOpenChange(false),
    [onPickerOpenChange],
  );

  const sendReaction = async (emoji: string) => {
    setPending(true);
    const reaction = myReaction?.emoji === emoji ? "" : emoji;
    const result = await triggerWahaReaction({
      restaurantId,
      messageId: wahaMessageId,
      reaction,
    });
    setPending(false);
    if (!result.ok) {
      toast.error(`Reaction: ${result.error}`);
      return;
    }
    setEmojiSheetOpen(false);
    closePicker();
    onUpdated?.();
  };

  useEffect(() => {
    if (!pickerOpen) return;
    const onDocPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        closePicker();
      }
    };
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, [pickerOpen, closePicker]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {/* WhatsApp: Schnell-Reactions nur bei Hover / Long-Press */}
      <div
        className={cn(
          "absolute z-20 flex items-center gap-0.5 rounded-full border border-border/60 bg-popover px-0.5 py-0.5 text-popover-foreground shadow-md transition-opacity duration-150",
          outbound ? "right-0" : "left-0",
          "bottom-full mb-1.5",
          pickerOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0 group-hover/bubble:pointer-events-auto group-hover/bubble:opacity-100",
          pending && "pointer-events-none opacity-60",
          deleting && "pointer-events-none opacity-60",
          editing && "pointer-events-none opacity-60",
        )}
        role="toolbar"
        aria-label="Reagieren"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            disabled={pending}
            aria-label={`Reagieren mit ${emoji}`}
            className={cn(
              "rounded-full px-1.5 py-0.5 text-lg leading-none transition-colors hover:bg-muted",
              myReaction?.emoji === emoji &&
                "bg-accent/15 ring-1 ring-accent/30",
            )}
            onClick={() => void sendReaction(emoji)}
          >
            {emoji}
          </button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-7 shrink-0 rounded-full"
          aria-label="Weitere Emojis"
          disabled={pending}
          onClick={() => {
            closePicker();
            setEmojiSheetOpen(true);
          }}
        >
          <Plus className="size-4" strokeWidth={2.25} aria-hidden />
        </Button>
        {onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-7 shrink-0 rounded-full"
            aria-label="Nachricht bearbeiten"
            disabled={pending || deleting || editing}
            onClick={onEdit}
          >
            <Pencil className="size-3.5" aria-hidden />
          </Button>
        ) : null}
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-7 shrink-0 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label="Nachricht löschen"
            disabled={pending || deleting}
            onClick={() => void onDelete()}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        ) : null}
      </div>

      {grouped.length > 0 ? (
        <div
          className={cn(
            "flex",
            outbound ? "justify-end" : "justify-start",
            "-mt-1.5",
          )}
        >
          <div
            className={cn(
              "inline-flex flex-wrap items-center gap-0.5 rounded-full border border-border/60 bg-background/95 px-1 py-0.5 text-xs shadow-sm",
              outbound ? "-mr-0.5" : "-ml-0.5",
            )}
          >
            {grouped.map((g) => (
              <button
                key={g.emoji}
                type="button"
                disabled={pending}
                title={
                  g.includesMe
                    ? "Eigene Reaction ändern"
                    : `${g.count} Reaction${g.count > 1 ? "s" : ""}`
                }
                onClick={() => void sendReaction(g.emoji)}
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 transition-colors hover:bg-muted/80",
                  g.includesMe && "ring-1 ring-accent/40",
                )}
              >
                <span aria-hidden>{g.emoji}</span>
                {g.count > 1 ? (
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {g.count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <ContactMessageEmojiPickerSheet
        open={emojiSheetOpen}
        onOpenChange={setEmojiSheetOpen}
        onPick={(emoji) => void sendReaction(emoji)}
      />
    </div>
  );
}
