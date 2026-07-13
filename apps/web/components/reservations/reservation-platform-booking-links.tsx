"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { InstagramGlyph } from "@/components/icons/instagram-glyph";
import { Button } from "@/components/ui/button";
import { integrationSyncErrorMessage } from "@/lib/integrations/integration-sync-user-messages";
import { integrationPlatformSyncButtonClassName } from "@/lib/ui/integration-platform-sync-button";
import { cn } from "@/lib/utils";

type BookingLinkTarget = "google" | "facebook" | "instagram";

const ENDPOINTS: Record<BookingLinkTarget, string> = {
  google: "/api/integrations/google-business/sync-reservation-link",
  facebook: "/api/integrations/facebook/sync-reservation-cta",
  instagram: "/api/integrations/instagram/sync-reservation-cta",
};

const LABELS: Record<BookingLinkTarget, string> = {
  google: "Reservierungs-Link an Google übertragen",
  facebook: "Reservieren-Button an Facebook übertragen",
  instagram: "Reservieren-Button an Instagram übertragen",
};

const SUCCESS: Record<BookingLinkTarget, string> = {
  google: "Reservierungs-Link wurde bei Google Business hinterlegt.",
  facebook: "Reservieren-Button wurde auf der Facebook-Seite gesetzt.",
  instagram: "Reservieren-Button wurde für Instagram konfiguriert.",
};

function PlatformIcon({ target }: { target: BookingLinkTarget }) {
  const className = "size-4 shrink-0";
  if (target === "google") return <GoogleGlyph className={className} aria-hidden />;
  if (target === "facebook") return <FacebookGlyph className={className} aria-hidden />;
  return <InstagramGlyph className={className} aria-hidden />;
}

function platformLabel(target: BookingLinkTarget): string {
  if (target === "google") return "Google";
  if (target === "facebook") return "Facebook";
  return "Instagram";
}

async function postBookingLinkSync(
  target: BookingLinkTarget,
  restaurantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(ENDPOINTS[target], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error ?? "sync_failed" };
  }
  return { ok: true };
}

function BookingLinkButton({
  target,
  restaurantId,
  connected,
  connectionsLoading,
}: {
  target: BookingLinkTarget;
  restaurantId: string | null;
  connected: boolean;
  connectionsLoading?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const disabled =
    connectionsLoading || !restaurantId || !connected || busy;

  return (
    <Button
      type="button"
      variant="outline"
      className={integrationPlatformSyncButtonClassName}
      disabled={disabled}
      title={
        !connected
          ? `${platformLabel(target)} unter Einstellungen → Integrationen verbinden`
          : undefined
      }
      onClick={() => {
        if (!restaurantId || !connected) return;
        setBusy(true);
        void postBookingLinkSync(target, restaurantId)
          .then((result) => {
            if (!result.ok) {
              toast.error(
                `${platformLabel(target)}: ${integrationSyncErrorMessage(result.error)}`,
              );
              return;
            }
            toast.success(SUCCESS[target]);
          })
          .catch(() => {
            toast.error(`${platformLabel(target)}: Übertragung fehlgeschlagen.`);
          })
          .finally(() => setBusy(false));
      }}
    >
      <PlatformIcon target={target} />
      {busy ? "Wird übertragen…" : LABELS[target]}
    </Button>
  );
}

export function ReservationPlatformBookingLinks({
  restaurantId,
  googleConnected,
  facebookConnected,
  instagramConnected,
  connectionsLoading = false,
  className,
}: {
  restaurantId: string | null;
  googleConnected: boolean;
  facebookConnected: boolean;
  instagramConnected: boolean;
  connectionsLoading?: boolean;
  className?: string;
}) {
  const anyVisible = googleConnected || facebookConnected || instagramConnected;
  if (!anyVisible && !connectionsLoading) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <p className="text-sm font-medium">Buchung auf Profilen</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Überträgt eure Gwada-Buchungs-URL als Reservieren-Button bzw.
          Business Link. Voraussetzung: Restaurant veröffentlicht und
          Plattform unter Integrationen verbunden.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {googleConnected ? (
          <BookingLinkButton
            target="google"
            restaurantId={restaurantId}
            connected={googleConnected}
            connectionsLoading={connectionsLoading}
          />
        ) : null}
        {facebookConnected ? (
          <BookingLinkButton
            target="facebook"
            restaurantId={restaurantId}
            connected={facebookConnected}
            connectionsLoading={connectionsLoading}
          />
        ) : null}
        {instagramConnected ? (
          <BookingLinkButton
            target="instagram"
            restaurantId={restaurantId}
            connected={instagramConnected}
            connectionsLoading={connectionsLoading}
          />
        ) : null}
      </div>
    </div>
  );
}
