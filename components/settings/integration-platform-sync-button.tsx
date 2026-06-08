"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { Button } from "@/components/ui/button";
import {
  integrationPlatformSyncLabel,
  integrationSyncSuccessMessage,
  postIntegrationPlatformSync,
  type IntegrationPlatformSyncTarget,
} from "@/lib/integrations/integration-platform-sync-client";
import { integrationSyncErrorMessage } from "@/lib/integrations/integration-sync-user-messages";
import { integrationPlatformSyncButtonClassName } from "@/lib/ui/integration-platform-sync-button";
import { cn } from "@/lib/utils";

type SyncTarget = IntegrationPlatformSyncTarget;

const LABELS: Record<SyncTarget, string> = {
  opening_hours_google: "Öffnungszeiten an Google übertragen",
  opening_hours_facebook: "Öffnungszeiten an Facebook übertragen",
  kitchen_hours_google: "Küchenzeiten an Google übertragen",
  opening_exceptions_google: "Ausnahmen an Google übertragen",
  menu_google: "Speisekarte an Google übertragen",
};

function SyncButtonPlatformIcon({ target }: { target: SyncTarget }) {
  const iconClass = "size-4 shrink-0";
  if (target === "opening_hours_facebook") {
    return <FacebookGlyph className={iconClass} aria-hidden />;
  }
  if (
    target === "opening_hours_google" ||
    target === "kitchen_hours_google" ||
    target === "opening_exceptions_google" ||
    target === "menu_google"
  ) {
    return <GoogleGlyph className={iconClass} aria-hidden />;
  }
  return null;
}

export function IntegrationPlatformSyncButton({
  target,
  restaurantId,
  connected,
  connectionsLoading = false,
  blockedReason,
  onSynced,
  className,
}: {
  target: SyncTarget;
  restaurantId: string | null;
  connected: boolean;
  connectionsLoading?: boolean;
  blockedReason?: string | null;
  onSynced?: () => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const disabled =
    connectionsLoading ||
    !restaurantId ||
    !connected ||
    busy ||
    Boolean(blockedReason);

  const handleClick = async () => {
    if (!restaurantId || !connected) return;
    setBusy(true);
    try {
      const result = await postIntegrationPlatformSync(target, restaurantId);
      if (!result.ok) {
        toast.error(
          `${integrationPlatformSyncLabel(target)}: ${integrationSyncErrorMessage(result.error)}`,
        );
        return;
      }
      toast.success(
        `${integrationPlatformSyncLabel(target)}: ${integrationSyncSuccessMessage(target, result.itemCount)}`,
      );
      onSynced?.();
    } catch {
      toast.error(`${integrationPlatformSyncLabel(target)}: Übertragung fehlgeschlagen.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={cn(integrationPlatformSyncButtonClassName, className)}
      disabled={disabled}
      title={
        blockedReason ??
        (!connected
          ? "Plattform unter Einstellungen → Integrationen verbinden"
          : undefined)
      }
      onClick={() => void handleClick()}
    >
      <SyncButtonPlatformIcon target={target} />
      {busy ? "Wird übertragen…" : LABELS[target]}
    </Button>
  );
}
