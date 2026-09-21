"use client";

import { useEffect, useState } from "react";
import type { ReservationWhatsappOutboxHealth } from "@/lib/whatsapp/reservation-whatsapp-outbox-health";

function formatWhen(iso: string | null): string {
  if (!iso) return "noch kein Versand";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function WhatsappOutboxHealthPanel({
  restaurantId,
}: {
  restaurantId: string;
}) {
  const [health, setHealth] = useState<ReservationWhatsappOutboxHealth | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const q = new URLSearchParams({ restaurantId });
      const res = await fetch(
        `/api/reservations/whatsapp/outbox-health?${q}`,
        { cache: "no-store" },
      );
      if (!res.ok || cancelled) return;
      const body = (await res.json()) as ReservationWhatsappOutboxHealth;
      if (!cancelled) setHealth(body);
    };
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [restaurantId]);

  if (!health) return null;

  const problem = health.failedOpen > 0 || health.retrying > 0;

  return (
    <div className="rounded-xl border border-border/50 bg-background px-4 py-3 text-sm">
      <p className="font-medium">Nachrichten-Status</p>
      <p className="mt-1 text-muted-foreground">
        Zuletzt rausgegangen: {formatWhen(health.lastSentAt)} · {health.sent24h}{" "}
        in 24 h
      </p>
      <p className={problem ? "mt-1 text-destructive" : "mt-1 text-muted-foreground"}>
        Offen fällig: {health.dueScheduled}
        {health.retrying ? ` · Prüfung/Retry: ${health.retrying}` : ""}
        {health.failedOpen ? ` · fehlgeschlagen: ${health.failedOpen}` : ""}
      </p>
      {health.lastError ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          Letzter Fehler: {health.lastError}
        </p>
      ) : null}
    </div>
  );
}
