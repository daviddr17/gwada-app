"use client";

import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
  GUEST_STATUS_STEPS_DELIVERY,
  GUEST_STATUS_STEPS_PICKUP,
} from "@/lib/ordering/guest-order-labels";
import { formatEuroFromCents } from "@/lib/ordering/guest-cart-types";
import { cn } from "@/lib/utils";

type OrderDto = {
  orderNumber: number;
  status: string;
  statusLabel: string;
  fulfillmentType: string;
  totalCents: number;
  deliveryFeeCents: number;
  guestName: string | null;
  restaurantName: string;
  restaurantSlug: string;
  slotStartAt: string | null;
  slotEndAt: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryLocationUpdatedAt: string | null;
  deliveryTrackingActive: boolean;
  lines: Array<{
    name: string;
    quantity: number;
    lineTotalCents: number;
    modifiers: unknown;
  }>;
  paymentStatus: string | null;
  checkoutUrl: string | null;
  message: string | null;
};

export function GuestOrderStatusScreen({ token }: { token: string }) {
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useDeferredSkeleton(loading && !order);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/public/ordering/status/${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as { order?: OrderDto; error?: string };
      if (!res.ok || !json.order) {
        setError(json.error ?? "nicht gefunden");
        return;
      }
      setOrder(json.order);
      setError(null);
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(id);
  }, [load]);

  if (showSkeleton) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6" aria-busy>
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center text-muted-foreground">
        Bestellung nicht gefunden.
      </div>
    );
  }

  const steps =
    order.fulfillmentType === "delivery"
      ? GUEST_STATUS_STEPS_DELIVERY
      : GUEST_STATUS_STEPS_PICKUP;
  const activeIdx = Math.max(
    0,
    steps.findIndex((s) => s === order.status),
  );
  const pendingPay = order.status === "pending_payment";

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <p className="text-sm text-muted-foreground">{order.restaurantName}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        Bestellung #{order.orderNumber}
      </h1>
      <p className="mt-2 text-lg font-medium">{order.statusLabel}</p>
      {order.slotStartAt ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Zeitfenster:{" "}
          {new Date(order.slotStartAt).toLocaleString("de-DE", {
            dateStyle: "short",
            timeStyle: "short",
          })}
          {order.slotEndAt
            ? ` – ${new Date(order.slotEndAt).toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : ""}
        </p>
      ) : null}
      {order.message ? (
        <p className="mt-2 text-sm text-muted-foreground">{order.message}</p>
      ) : null}

      {order.fulfillmentType === "delivery" &&
      order.deliveryLat != null &&
      order.deliveryLng != null ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-border/50">
          <iframe
            title="Lieferposition"
            className="h-56 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${
              order.deliveryLng - 0.02
            }%2C${order.deliveryLat - 0.015}%2C${order.deliveryLng + 0.02}%2C${
              order.deliveryLat + 0.015
            }&layer=mapnik&marker=${order.deliveryLat}%2C${order.deliveryLng}`}
          />
          <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
            <span>
              {order.deliveryTrackingActive
                ? "Live-Standort (wird aktualisiert)"
                : "Letzter bekannter Standort"}
              {order.deliveryLocationUpdatedAt
                ? ` · ${new Date(order.deliveryLocationUpdatedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
                : ""}
            </span>
            <a
              className="underline"
              href={`https://www.openstreetmap.org/?mlat=${order.deliveryLat}&mlon=${order.deliveryLng}#map=15/${order.deliveryLat}/${order.deliveryLng}`}
              target="_blank"
              rel="noreferrer"
            >
              Karte öffnen
            </a>
          </div>
        </div>
      ) : order.status === "out_for_delivery" ? (
        <p className="mt-4 rounded-xl border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
          Lieferung unterwegs — Standort erscheint, sobald das Team trackt.
        </p>
      ) : null}

      {pendingPay && order.checkoutUrl ? (
        <a
          href={order.checkoutUrl}
          className="mt-4 flex h-12 items-center justify-center rounded-xl bg-foreground text-background"
        >
          Zahlung fortsetzen
        </a>
      ) : null}

      {!pendingPay && order.status !== "cancelled" ? (
        <ol className="mt-8 space-y-3">
          {steps.map((step, idx) => {
            const done = idx <= activeIdx || order.status === "delivered";
            const current = step === order.status;
            return (
              <li
                key={step}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3",
                  current
                    ? "border-foreground/30 bg-muted/40"
                    : "border-border/50",
                  done ? "opacity-100" : "opacity-45",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                    done
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {idx + 1}
                </span>
                <StatusStepLabel
                  step={step}
                  fulfillment={order.fulfillmentType}
                />
              </li>
            );
          })}
        </ol>
      ) : null}

      <div className="mt-8 space-y-2 rounded-2xl border border-border/50 p-4">
        {order.lines.map((line, i) => (
          <div key={i} className="flex justify-between gap-3 text-sm">
            <span>
              {line.quantity}× {line.name}
            </span>
            <span>{formatEuroFromCents(line.lineTotalCents)}</span>
          </div>
        ))}
        {order.deliveryFeeCents > 0 ? (
          <div className="flex justify-between gap-3 text-sm text-muted-foreground">
            <span>Liefergebühr</span>
            <span>{formatEuroFromCents(order.deliveryFeeCents)}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 border-t border-border/50 pt-2 font-semibold">
          <span>Gesamt</span>
          <span>{formatEuroFromCents(order.totalCents)}</span>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Diese Seite aktualisiert sich automatisch.
      </p>
    </div>
  );
}

function StatusStepLabel({
  step,
  fulfillment,
}: {
  step: string;
  fulfillment: string;
}) {
  const delivery = fulfillment === "delivery";
  const label =
    step === "received"
      ? "Angenommen"
      : step === "preparing"
        ? "In Zubereitung"
        : step === "ready"
          ? delivery
            ? "Fertig zur Lieferung"
            : "Abholbereit"
          : step === "out_for_delivery"
            ? "In Lieferung"
            : step === "delivered"
              ? delivery
                ? "Geliefert"
                : "Abgeholt"
              : step;
  return <span>{label}</span>;
}
