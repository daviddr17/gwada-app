"use client";

import { useTranslations } from "next-intl";
import { Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { feedPinnedBadgeClassName } from "@/lib/ui/feed-pin-styles";
import { cn } from "@/lib/utils";

export function FeedPinnedBadge({ className }: { className?: string }) {
  const t = useTranslations("Embed");
  return (
    <Badge
      variant="secondary"
      className={cn("gap-1 text-[10px]", feedPinnedBadgeClassName, className)}
    >
      <Pin className="size-3" aria-hidden />
      {t("feedPinned")}
    </Badge>
  );
}
