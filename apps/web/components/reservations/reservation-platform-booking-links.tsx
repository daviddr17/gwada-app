"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { InstagramGlyph } from "@/components/icons/instagram-glyph";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { integrationSyncErrorMessage } from "@/lib/integrations/integration-sync-user-messages";
import { integrationPlatformSyncButtonClassName } from "@/lib/ui/integration-platform-sync-button";
import { cn } from "@/lib/utils";

type BookingLinkTarget = "facebook" | "instagram";

const ENDPOINTS: Record<BookingLinkTarget, string> = {
  facebook: "/api/integrations/facebook/sync-reservation-cta",
  instagram: "/api/integrations/instagram/sync-reservation-cta",
};

const LABELS: Record<BookingLinkTarget, string> = {
  facebook: "Reservieren-Button an Facebook übertragen",
  instagram: "Reservieren-Button an Instagram übertragen",
};

const SUCCESS: Record<BookingLinkTarget, string> = {
  facebook: "Reservieren-Button wurde auf der Facebook-Seite gesetzt.",
  instagram: "Reservieren-Button wurde für Instagram konfiguriert.",
};

function PlatformIcon({ target }: { target: "google" | BookingLinkTarget }) {
  const className = "size-4 shrink-0";
  if (target === "google") return <GoogleGlyph className={className} aria-hidden />;
  if (target === "facebook") return <FacebookGlyph className={className} aria-hidden />;
  return <InstagramGlyph className={className} aria-hidden />;
}

function platformLabel(target: "google" | BookingLinkTarget): string {
  if (target === "google") return "Google";
  if (target === "facebook") return "Facebook";
  return "Instagram";
}

async function postMetaBookingLinkSync(
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

function MetaBookingLinkButton({
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
        void postMetaBookingLinkSync(target, restaurantId)
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

function GoogleBookingLinkToggle({
  restaurantId,
  connected,
  connectionsLoading,
  enabled,
  onEnabledChange,
}: {
  restaurantId: string | null;
  connected: boolean;
  connectionsLoading?: boolean;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const disabled =
    connectionsLoading || !restaurantId || !connected || busy;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background">
          <PlatformIcon target="google" />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">Google Reservieren-Link</p>
          <p className="text-xs text-muted-foreground">
            Zeigt auf dem Google-Profil / in Maps einen Reservieren-Button mit
            eurer Gwada-Buchungsseite.
          </p>
        </div>
      </div>
      <Switch
        checked={enabled}
        disabled={disabled}
        size="sm"
        aria-label="Google Reservieren-Link aktivieren"
        title={
          !connected
            ? "Google unter Einstellungen → Integrationen verbinden"
            : undefined
        }
        onCheckedChange={(value) => {
          if (!restaurantId || !connected || busy) return;
          const next = value === true;
          const previous = enabled;
          onEnabledChange(next);
          setBusy(true);
          void fetch("/api/integrations/google-business/sync-reservation-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restaurantId, enabled: next }),
          })
            .then(async (res) => {
              const data = (await res.json().catch(() => ({}))) as {
                ok?: boolean;
                error?: string;
              };
              if (!res.ok || !data.ok) {
                onEnabledChange(previous);
                toast.error(
                  `Google: ${integrationSyncErrorMessage(data.error ?? "sync_failed")}`,
                );
                return;
              }
              toast.success(
                next
                  ? "Google Reservieren-Link ist aktiv."
                  : "Google Reservieren-Link wurde entfernt.",
              );
            })
            .catch(() => {
              onEnabledChange(previous);
              toast.error("Google: Übertragung fehlgeschlagen.");
            })
            .finally(() => setBusy(false));
        }}
      />
    </div>
  );
}

export function ReservationPlatformBookingLinks({
  restaurantId,
  googleConnected,
  facebookConnected,
  instagramConnected,
  googleBookingLinkEnabled,
  onGoogleBookingLinkEnabledChange,
  connectionsLoading = false,
  className,
}: {
  restaurantId: string | null;
  googleConnected: boolean;
  facebookConnected: boolean;
  instagramConnected: boolean;
  googleBookingLinkEnabled: boolean;
  onGoogleBookingLinkEnabledChange: (enabled: boolean) => void;
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
      <div className="flex flex-col gap-2">
        {googleConnected ? (
          <GoogleBookingLinkToggle
            restaurantId={restaurantId}
            connected={googleConnected}
            connectionsLoading={connectionsLoading}
            enabled={googleBookingLinkEnabled}
            onEnabledChange={onGoogleBookingLinkEnabledChange}
          />
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {facebookConnected ? (
            <MetaBookingLinkButton
              target="facebook"
              restaurantId={restaurantId}
              connected={facebookConnected}
              connectionsLoading={connectionsLoading}
            />
          ) : null}
          {instagramConnected ? (
            <MetaBookingLinkButton
              target="instagram"
              restaurantId={restaurantId}
              connected={instagramConnected}
              connectionsLoading={connectionsLoading}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
