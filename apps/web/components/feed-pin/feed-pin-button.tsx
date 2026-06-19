"use client";

import { Pin, PinOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setFeedItemPin } from "@/lib/feed-pin/feed-pin-client";
import type { FeedPinModule } from "@/lib/feed-pin/feed-pin-types";
import { cn } from "@/lib/utils";

export function FeedPinButton({
  restaurantId,
  module,
  platform,
  itemId,
  isPinned = false,
  disabled = false,
  className,
  onChanged,
}: {
  restaurantId: string;
  module: FeedPinModule;
  platform: string;
  itemId: string;
  isPinned?: boolean;
  disabled?: boolean;
  className?: string;
  onChanged?: (nextPinned: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy || disabled) return;
    setBusy(true);
    const nextPinned = !isPinned;
    try {
      const result = await setFeedItemPin({
        restaurantId,
        module,
        platform,
        itemId,
        pinned: nextPinned,
      });
      if ("error" in result) {
        toast.error("Anpinnen fehlgeschlagen.");
        return;
      }
      toast.success(
        result.isPinned
          ? "Beitrag angepinnt — erscheint oben im Feed."
          : "Pin entfernt.",
      );
      onChanged?.(result.isPinned);
    } catch {
      toast.error("Netzwerkfehler beim Anpinnen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant={isPinned ? "secondary" : "outline"}
      size="sm"
      className={cn("gap-1.5", className)}
      disabled={disabled || busy}
      onClick={() => void toggle()}
    >
      {isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
      {isPinned ? "Pin lösen" : "Anpinnen"}
    </Button>
  );
}
