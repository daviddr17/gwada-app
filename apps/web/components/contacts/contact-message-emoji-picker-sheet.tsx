"use client";

import { useMemo, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { EMOJI_PICKER_CATEGORIES } from "@/lib/constants/emoji-picker-categories";
import { appMobileBottomSafePbClassName } from "@/lib/ui/app-mobile-bottom-nav";
import { cn } from "@/lib/utils";

export function ContactMessageEmojiPickerSheet({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (emoji: string) => void;
}) {
  const [categoryId, setCategoryId] = useState(EMOJI_PICKER_CATEGORIES[0]?.id ?? "");

  const category = useMemo(
    () =>
      EMOJI_PICKER_CATEGORIES.find((c) => c.id === categoryId) ??
      EMOJI_PICKER_CATEGORIES[0],
    [categoryId],
  );

  const pick = (emoji: string) => {
    onPick(emoji);
    onOpenChange(false);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent
        showHandle
        className={cn("mx-auto flex max-h-[min(85dvh,560px)] w-full max-w-lg flex-col gap-0 rounded-t-[1.75rem] border-0 bg-popover p-0 shadow-elevated", appMobileBottomSafePbClassName)}
      >
        <DrawerTitle className="sr-only">Emoji auswählen</DrawerTitle>

        <div
          className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-border/50 px-2 py-2"
          role="tablist"
          aria-label="Emoji-Kategorien"
        >
          {EMOJI_PICKER_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={cat.id === categoryId}
              aria-label={cat.label}
              title={cat.label}
              className={cn(
                "shrink-0 rounded-xl px-2.5 py-1.5 text-xl leading-none transition-colors",
                cat.id === categoryId
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60",
              )}
              onClick={() => setCategoryId(cat.id)}
            >
              {cat.tabIcon}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          <div
            className="grid grid-cols-8 gap-0.5 sm:grid-cols-9"
            role="grid"
            aria-label={category?.label}
          >
            {category?.emojis.map((emoji) => (
              <button
                key={`${category.id}-${emoji}`}
                type="button"
                role="gridcell"
                className="flex aspect-square items-center justify-center rounded-lg text-[1.65rem] leading-none transition-colors hover:bg-muted active:bg-muted/80"
                aria-label={`Emoji ${emoji}`}
                onClick={() => pick(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
