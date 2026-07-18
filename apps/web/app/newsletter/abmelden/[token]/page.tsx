"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";

export default function NewsletterAbmeldenPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";
  const [email, setEmail] = useState<string | null>(null);
  const [optedIn, setOptedIn] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token || token === "preview") {
      setError(
        token === "preview"
          ? "Vorschau-Link — keine echte Abmeldung."
          : "Ungültiger Link",
      );
      return;
    }
    void (async () => {
      const res = await fetch(
        `/api/public/newsletter/unsubscribe?token=${encodeURIComponent(token)}`,
      );
      const data = (await res.json()) as {
        email?: string;
        optedIn?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Link ungültig");
        return;
      }
      setEmail(data.email ?? null);
      setOptedIn(data.optedIn !== false);
      if (data.optedIn === false) setDone(true);
    })();
  }, [token]);

  const unsubscribe = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/public/newsletter/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Abmeldung fehlgeschlagen");
        return;
      }
      setDone(true);
      setOptedIn(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Newsletter abmelden
      </h1>
      {error ? (
        <p className="mt-6 text-sm text-muted-foreground">{error}</p>
      ) : done || !optedIn ? (
        <p className="mt-6 text-sm text-foreground">
          Du bist abgemeldet{email ? ` (${email})` : ""}. Du kannst dich später
          wieder unter /newsletter/anmelden anmelden.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            {email
              ? `Abmelden für ${email}?`
              : "Vom Gwada-Newsletter abmelden?"}
          </p>
          <Button
            type="button"
            className={brandActionButtonRoundedClassName}
            disabled={saving}
            onClick={() => void unsubscribe()}
          >
            Abmelden
          </Button>
        </div>
      )}
    </main>
  );
}
