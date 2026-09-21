"use client";

import { toast } from "sonner";
import { registeredUserLimitToastMessage } from "@/lib/billing/registered-user-seats";

export function toastRegisteredUserLimit(opts?: {
  cap?: number | null;
  onOpenBilling?: () => void;
}): void {
  toast.error(registeredUserLimitToastMessage(opts?.cap), {
    duration: 12_000,
    action: opts?.onOpenBilling
      ? { label: "Zum Abo", onClick: opts.onOpenBilling }
      : undefined,
  });
}
