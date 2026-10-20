"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GuestOrderingApp } from "@/components/ordering/guest-ordering-app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  mode: "kiosk" | "table";
  diningTableId?: string;
  restaurantName?: string;
  accentHex?: string;
};

type Phase = "attract" | "ordering" | "thanks" | "staff";

/**
 * Locked guest kiosk shell for:
 * - iPad table (Single App Mode) → channel `table`
 * - Android/Linux counter units (Lock Task) → channel `kiosk`
 *
 * Not a mobile website: no app chrome, history trap, idle reset, staff PIN exit.
 */
export function KioskLockedShell({
  slug,
  mode,
  diningTableId,
  restaurantName,
  accentHex = "#0f766e",
}: Props) {
  const [phase, setPhase] = useState<Phase>("attract");
  const [thanks, setThanks] = useState<{
    orderNumber: number;
    statusToken: string;
  } | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const [unlockedHint, setUnlockedHint] = useState(false);
  const logoTaps = useRef(0);
  const logoTimer = useRef<number | null>(null);

  // History trap — keep guests inside the kiosk shell
  useEffect(() => {
    const path = window.location.pathname + window.location.search;
    window.history.pushState({ kiosk: true }, "", path);
    const onPop = () => {
      window.history.pushState({ kiosk: true }, "", path);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Block common leave gestures where possible
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (phase === "staff" && unlockedHint) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase, unlockedHint]);

  const resetToAttract = useCallback(() => {
    setPhase("attract");
    setThanks(null);
    setPin("");
    setPinError(null);
  }, []);

  function onLogoTap() {
    logoTaps.current += 1;
    if (logoTimer.current) window.clearTimeout(logoTimer.current);
    logoTimer.current = window.setTimeout(() => {
      logoTaps.current = 0;
    }, 2000);
    if (logoTaps.current >= 5) {
      logoTaps.current = 0;
      setPhase("staff");
      setPin("");
      setPinError(null);
    }
  }

  async function tryUnlock() {
    setPinBusy(true);
    setPinError(null);
    try {
      const res = await fetch(
        `/api/public/ordering/${encodeURIComponent(slug)}/kiosk-unlock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        },
      );
      if (!res.ok) {
        setPinError("PIN falsch");
        setPin("");
        return;
      }
      setUnlockedHint(true);
    } catch {
      setPinError("Netzwerkfehler");
    } finally {
      setPinBusy(false);
    }
  }

  return (
    <div
      data-kiosk-shell
      className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background text-foreground"
      style={
        {
          ["--kiosk-accent" as string]: accentHex,
        } as React.CSSProperties
      }
    >
      {phase === "attract" ? (
        <div className="relative flex h-full w-full flex-col items-center justify-center gap-8 px-8 text-center">
          <button
            type="button"
            className="absolute left-4 top-4 rounded-full px-4 py-2 text-sm text-muted-foreground"
            onClick={onLogoTap}
          >
            Gwada Kiosk
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-8"
            onClick={() => setPhase("ordering")}
          >
            <div>
              <p className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
                {restaurantName ?? "Willkommen"}
              </p>
              {mode === "table" && diningTableId ? (
                <p className="mt-3 text-lg font-medium text-muted-foreground sm:text-xl">
                  Tisch {diningTableId}
                </p>
              ) : null}
              <p className="mt-4 text-xl text-muted-foreground sm:text-2xl">
                Tippen zum Bestellen
              </p>
            </div>
            <span
              className="rounded-2xl px-10 py-5 text-xl font-medium text-white sm:text-2xl"
              style={{ backgroundColor: accentHex }}
            >
              Jetzt starten
            </span>
            <p className="max-w-md text-sm text-muted-foreground">
              {mode === "table"
                ? "Bestellung geht direkt in die Küche"
                : "Bestellung geht direkt an die Theke"}
            </p>
          </button>
        </div>
      ) : null}

      {phase === "ordering" ? (
        <GuestOrderingApp
          slug={slug}
          mode={mode}
          diningTableId={diningTableId}
          largeTouch
          className="h-full"
          onIdleReset={resetToAttract}
          onOrderPlaced={({ statusToken, orderNumber, checkoutUrl }) => {
            if (checkoutUrl) {
              // Mollie redirect — device lock should allow return URL
              return;
            }
            setThanks({ statusToken, orderNumber });
            setPhase("thanks");
          }}
        />
      ) : null}

      {phase === "thanks" && thanks ? (
        <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
          <p className="text-2xl text-muted-foreground">Deine Nummer</p>
          <p
            className="text-7xl font-bold tabular-nums sm:text-8xl"
            style={{ color: accentHex }}
          >
            {thanks.orderNumber}
          </p>
          <p className="max-w-lg text-xl text-muted-foreground">
            Danke! Deine Bestellung ist eingegangen.
          </p>
          <Button
            type="button"
            size="lg"
            className="mt-4 h-16 rounded-2xl px-10 text-lg text-white"
            style={{ backgroundColor: accentHex }}
            onClick={resetToAttract}
          >
            Neue Bestellung
          </Button>
          <IdleThanks onIdle={resetToAttract} />
        </div>
      ) : null}

      {phase === "staff" ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
          <p className="text-2xl font-semibold">Mitarbeiter-Bereich</p>
          {!unlockedHint ? (
            <>
              <p className="text-muted-foreground">
                Display-PIN eingeben, um den Kiosk zu verlassen.
              </p>
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                className="h-16 w-48 text-center text-2xl tracking-[0.4em]"
              />
              {pinError ? (
                <p className="text-destructive" role="alert">
                  {pinError}
                </p>
              ) : null}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-14 rounded-xl px-6"
                  onClick={resetToAttract}
                >
                  Abbrechen
                </Button>
                <Button
                  type="button"
                  className="h-14 rounded-xl px-6 text-white"
                  style={{ backgroundColor: accentHex }}
                  disabled={pin.length !== 4 || pinBusy}
                  onClick={() => void tryUnlock()}
                >
                  Entsperren
                </Button>
              </div>
            </>
          ) : (
            <div className="max-w-md space-y-4 text-center">
              <p className="text-lg">
                Kiosk soft-entsperrt. Zum echten Verlassen Gerät-Lock beenden:
              </p>
              <ul className="list-inside list-disc text-left text-sm text-muted-foreground">
                <li>iPad: Guided Access / Single App Mode beenden</li>
                <li>Android-Kiosk: Lock Task / Kiosk-Launcher beenden</li>
              </ul>
              <Button
                type="button"
                className="h-14 rounded-xl px-6"
                variant="outline"
                onClick={resetToAttract}
              >
                Zurück zum Gast-Modus
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {/* Hidden staff entry affordance in non-attract phases */}
      {phase === "ordering" || phase === "thanks" ? (
        <button
          type="button"
          aria-label="Mitarbeiter"
          className={cn(
            "fixed bottom-2 left-2 z-50 size-10 opacity-0",
          )}
          onClick={onLogoTap}
        />
      ) : null}
    </div>
  );
}

function IdleThanks({ onIdle }: { onIdle: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onIdle, 20_000);
    return () => window.clearTimeout(t);
  }, [onIdle]);
  return null;
}
