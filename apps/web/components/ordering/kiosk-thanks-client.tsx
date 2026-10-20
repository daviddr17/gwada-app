"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

export function KioskThanksClient({
  slug,
  token,
}: {
  slug: string;
  token: string;
}) {
  const [orderNumber, setOrderNumber] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/public/ordering/status/${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as {
          order?: { orderNumber: number };
        };
        if (!cancelled && json.order?.orderNumber) {
          setOrderNumber(json.order.orderNumber);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      window.location.replace(`/kiosk/${encodeURIComponent(slug)}`);
    }, 25_000);
    return () => window.clearTimeout(t);
  }, [slug]);

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-2xl text-muted-foreground">Danke!</p>
      {orderNumber == null ? (
        <Skeleton className="h-20 w-32 rounded-xl" />
      ) : (
        <p className="text-7xl font-bold tabular-nums">{orderNumber}</p>
      )}
      <p className="max-w-md text-xl text-muted-foreground">
        Deine Bestellung ist eingegangen und erscheint in der Küche.
      </p>
      <Link
        href={`/kiosk/${encodeURIComponent(slug)}`}
        className="mt-4 rounded-2xl border border-border/60 px-8 py-4 text-lg"
      >
        Neue Bestellung
      </Link>
    </div>
  );
}
