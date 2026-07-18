"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";

export function NewsletterSubscriptionCard() {
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [saving, setSaving] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile/newsletter", { cache: "no-store" });
      const data = (await res.json()) as {
        subscribed?: boolean;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Newsletter-Status nicht ladbar");
        return;
      }
      setSubscribed(Boolean(data.subscribed));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onToggle = async (next: boolean) => {
    setSaving(true);
    const prev = subscribed;
    setSubscribed(next);
    try {
      const res = await fetch("/api/profile/newsletter", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscribed: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setSubscribed(prev);
        toast.error(data.error ?? "Speichern fehlgeschlagen");
        return;
      }
      toast.success(next ? "Newsletter aktiviert" : "Newsletter abgemeldet");
    } finally {
      setSaving(false);
    }
  };

  if (showSkeleton) {
    return <Skeleton className="h-28 w-full rounded-xl" />;
  }

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="gap-2">
        <CardTitle className="text-xl">Platform-Newsletter</CardTitle>
        <CardDescription className="text-base leading-relaxed">
          Produkt-Updates von Gwada per E-Mail. Abmelden geht auch über den Link
          in jeder Newsletter-Mail.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/15 px-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Newsletter erhalten</p>
            <p className="text-xs text-muted-foreground">
              Opt-in · Versand an deine Zustell-E-Mail
            </p>
          </div>
          <Switch
            checked={subscribed}
            disabled={saving}
            onCheckedChange={(checked) => void onToggle(checked)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
