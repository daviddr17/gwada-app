"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";

export default function NewsletterAnmeldenPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/public/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          locale: navigator.language?.slice(0, 2) || "de",
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Anmeldung fehlgeschlagen");
        return;
      }
      setDone(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Gwada Newsletter</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Neuigkeiten zur Plattform — jederzeit abmeldbar.
      </p>
      {done ? (
        <p className="mt-8 text-sm text-foreground">
          Danke — du bist angemeldet. Bitte prüfe ggf. auch deinen Spam-Ordner
          bei der ersten Mail.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nl-email">E-Mail</Label>
            <Input
              id="nl-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl"
              placeholder="name@beispiel.de"
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          <Button
            type="button"
            className={brandActionButtonRoundedClassName}
            disabled={saving || !email.includes("@")}
            onClick={() => void submit()}
          >
            Anmelden
          </Button>
        </div>
      )}
    </main>
  );
}
