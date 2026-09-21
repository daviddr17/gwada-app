"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRegisteredUserSeatUsage } from "@/lib/hooks/use-registered-user-seat-usage";
import { APP_ROUTES } from "@/lib/navigation/app-routes";
import { moduleManageChipButtonClassName } from "@/lib/ui/module-manage-chip";
import { cn } from "@/lib/utils";

export function StaffRegisteredUserSeatsChip({
  restaurantId,
  className,
}: {
  restaurantId: string;
  className?: string;
}) {
  const seats = useRegisteredUserSeatUsage(restaurantId);

  if (seats.loading || seats.cap == null) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        moduleManageChipButtonClassName,
        seats.atLimit && "border-amber-500/40 text-amber-900 dark:text-amber-100",
        className,
      )}
      render={<Link href={APP_ROUTES.settings.billing} />}
    >
      <Users className="size-4" />
      {seats.used}/{seats.cap} App-Logins
    </Button>
  );
}
