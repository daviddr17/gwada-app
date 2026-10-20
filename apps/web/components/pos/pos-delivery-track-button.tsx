"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = {
  restaurantId: string;
  orderId: string;
  fulfillmentType?: string;
  status: string;
  trackingActive?: boolean;
};

/** Staff: start out_for_delivery + stream geolocation pings while active. */
export function PosDeliveryTrackButton({
  restaurantId,
  orderId,
  fulfillmentType,
  status,
  trackingActive,
}: Props) {
  const [active, setActive] = useState(Boolean(trackingActive));
  const [busy, setBusy] = useState(false);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    setActive(Boolean(trackingActive));
  }, [trackingActive]);

  useEffect(() => {
    return () => {
      if (watchRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, []);

  if (fulfillmentType !== "delivery") return null;
  if (
    status !== "ready" &&
    status !== "out_for_delivery" &&
    status !== "preparing"
  ) {
    return null;
  }

  async function post(
    action: "start" | "ping" | "stop",
    coords?: { lat: number; lng: number },
  ) {
    const res = await fetch(`/api/ordering/delivery/${orderId}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId,
        action,
        ...(coords ?? {}),
      }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(json.error ?? "request_failed");
    }
  }

  function startWatch() {
    if (!navigator.geolocation) {
      toast.error("Standort ist auf diesem Gerät nicht verfügbar.");
      return;
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        void post("ping", {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }).catch(() => {
          /* quiet — network blips */
        });
      },
      () => {
        toast.error("Standortzugriff verweigert.");
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
  }

  async function toggle() {
    setBusy(true);
    try {
      if (!active) {
        await post("start");
        startWatch();
        setActive(true);
        toast.success("Lieferung gestartet — Standort wird geteilt.");
      } else {
        if (watchRef.current != null) {
          navigator.geolocation.clearWatch(watchRef.current);
          watchRef.current = null;
        }
        await post("stop");
        setActive(false);
        toast.success("Tracking gestoppt.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tracking fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      className="h-8 gap-1 rounded-full px-2.5 text-xs"
      disabled={busy}
      onClick={() => void toggle()}
    >
      <MapPin className="size-3.5" />
      {active ? "Tracking an" : "Liefern + GPS"}
    </Button>
  );
}
