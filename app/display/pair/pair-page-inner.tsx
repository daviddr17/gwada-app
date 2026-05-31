"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DisplayPairPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeParam = searchParams.get("code") ?? "";

  const [code, setCode] = useState(codeParam.toUpperCase());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pair = useCallback(async (pairCode: string) => {
    const normalized = pairCode.trim().toUpperCase();
    if (normalized.length !== 8) {
      setError("Der Kopplungscode hat 8 Zeichen.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/display/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      const data = (await res.json()) as {
        error?: string;
        restaurant?: { slug: string };
      };
      if (!res.ok) {
        const msg =
          data.error === "code_expired"
            ? "Code abgelaufen — bitte in den Einstellungen neu erzeugen."
            : data.error === "code_not_found"
              ? "Code ungültig."
              : data.error === "display_inactive"
                ? "Display ist deaktiviert."
                : data.error === "server_misconfigured"
                  ? "Server-Konfiguration unvollständig (Service-Role-Key)."
                  : data.error === "restaurant_not_found"
                    ? "Restaurant nicht gefunden."
                    : "Kopplung fehlgeschlagen.";
        setError(msg);
        return;
      }
      toast.success("Tablet gekoppelt.");
      router.replace(`/display/${data.restaurant?.slug ?? ""}`);
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setBusy(false);
    }
  }, [router]);

  useEffect(() => {
    if (codeParam.length === 8) {
      void pair(codeParam);
    }
  }, [codeParam, pair]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      <div className="max-w-md space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Display koppeln</h1>
        <p className="text-muted-foreground">
          QR-Code scannen oder Kopplungscode aus den Einstellungen eingeben.
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4">
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={8}
          value={code}
          onChange={(e) =>
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
          }
          placeholder="ABCDEF12"
          className="h-16 rounded-2xl border border-input bg-background px-4 text-center text-2xl font-semibold tracking-[0.3em] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {error ? (
          <p className="text-center text-sm text-destructive">{error}</p>
        ) : null}
        <Button
          size="lg"
          className="h-14 rounded-2xl text-lg"
          disabled={busy || code.length !== 8}
          onClick={() => void pair(code)}
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 size-5 animate-spin" />
              Wird gekoppelt …
            </>
          ) : (
            "Koppeln"
          )}
        </Button>
      </div>
    </div>
  );
}
