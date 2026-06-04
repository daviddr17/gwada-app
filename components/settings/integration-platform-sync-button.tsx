"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { Button } from "@/components/ui/button";
import { integrationSyncErrorMessage } from "@/lib/integrations/integration-sync-user-messages";
import { integrationPlatformSyncButtonClassName } from "@/lib/ui/integration-platform-sync-button";
import { cn } from "@/lib/utils";

type SyncTarget =
  | "opening_hours_google"
  | "opening_hours_facebook"
  | "kitchen_hours_google"
  | "opening_exceptions_google"
  | "menu_google";

const LABELS: Record<SyncTarget, string> = {
  opening_hours_google: "Öffnungszeiten an Google übertragen",
  opening_hours_facebook: "Öffnungszeiten an Facebook übertragen",
  kitchen_hours_google: "Küchenzeiten an Google übertragen",
  opening_exceptions_google: "Ausnahmen an Google übertragen",
  menu_google: "Speisekarte an Google übertragen",
};

const ENDPOINTS: Record<SyncTarget, string> = {
  opening_hours_google:
    "/api/integrations/google-business/sync-opening-hours",
  opening_hours_facebook: "/api/integrations/facebook/sync-opening-hours",
  kitchen_hours_google:
    "/api/integrations/google-business/sync-kitchen-hours",
  opening_exceptions_google:
    "/api/integrations/google-business/sync-opening-exceptions",
  menu_google: "/api/integrations/google-business/sync-menu",
};

const SUCCESS_HINTS: Partial<Record<SyncTarget, string>> = {
  opening_exceptions_google:
    "Zukünftige Ausnahmen wurden an Google übertragen.",
  kitchen_hours_google: "Küchenzeiten wurden an Google übertragen.",
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
      const res = await fetch(ENDPOINTS[target], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        itemCount?: number;
      };
      if (!res.ok || !data.ok) {
        toast.error(integrationSyncErrorMessage(data.error ?? "sync_failed"));
        return;
      }
      if (target === "menu_google" && data.itemCount != null) {
        toast.success(
          `Speisekarte übertragen (${data.itemCount} ${data.itemCount === 1 ? "Gericht" : "Gerichte"}).`,
        );
      } else {
        toast.success(SUCCESS_HINTS[target] ?? "Erfolgreich übertragen.");
      }
      onSynced?.();
    } catch {
      toast.error("Übertragung fehlgeschlagen.");
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
