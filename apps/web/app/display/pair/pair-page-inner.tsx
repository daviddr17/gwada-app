"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import {
  DisplayPairSuccessCelebration,
  displayPairSuccessNavigateDelayMs,
} from "@/components/display/display-pair-success-celebration";
import { DisplayChromeHeader } from "@/components/display/display-chrome-header";
import { Button } from "@/components/ui/button";
import {
  displayChromeMainClassName,
  displayChromeShellClassName,
} from "@/lib/ui/display-chrome";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import {
  getOrCreateDisplayInstallationId,
  saveDisplayDeviceCredential,
} from "@/lib/display/display-device-storage";
import {
  normalizeDisplayPairingCode,
  parseDisplayPairingInput,
} from "@/lib/display/display-pairing-input";
import { MOTION_EASE_OUT } from "@/lib/ui/motion-presets";
import { cn } from "@/lib/utils";

type PairSuccessState = {
  slug: string;
  restaurantName?: string;
  accentHex?: string | null;
};

export default function DisplayPairPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeParam = searchParams.get("code") ?? "";
  const reduceMotion = useReducedMotion() ?? false;

  const codeFromUrl = useMemo(
    () => parseDisplayPairingInput(codeParam) ?? normalizeDisplayPairingCode(codeParam),
    [codeParam],
  );

  const [code, setCode] = useState(codeFromUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<PairSuccessState | null>(null);
  const autoPairAttemptRef = useRef<string | null>(null);
  const pairedRedirectRef = useRef(false);

  useEffect(() => {
    if (pairedRedirectRef.current) return;
    void (async () => {
      try {
        const res = await fetch("/api/display/context", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { paired?: boolean; restaurant?: { slug?: string } };
        const slug = data.restaurant?.slug?.trim();
        if (data.paired && slug) {
          pairedRedirectRef.current = true;
          router.replace(`/display/${slug}`);
        }
      } catch {
        /* Pair-Formular bleibt sichtbar */
      }
    })();
  }, [router]);

  const pair = useCallback(async (pairCode: string) => {
    const normalized =
      parseDisplayPairingInput(pairCode) ?? normalizeDisplayPairingCode(pairCode);
    if (!normalized) {
      setError("Bitte 8-stelligen Code oder Kopplungslink eingeben.");
      return;
    }
    setBusy(true);
    setError(null);
    let paired = false;
    try {
      const installationId = getOrCreateDisplayInstallationId();
      const res = await fetch("/api/display/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized, installation_id: installationId }),
      });
      const data = (await res.json()) as {
        error?: string;
        restaurant?: { slug: string; name?: string; accent_hex?: string | null };
        display_id?: string;
        device_token?: string;
        installation_id?: string;
      };
      if (!res.ok) {
        const msg =
          data.error === "code_expired"
            ? "Code abgelaufen — bitte in den Einstellungen neu erzeugen."
            : data.error === "code_not_found" || data.error === "invalid_code"
              ? "Code ungültig — prüfe den aktuellen Code in den Einstellungen (nach „Neu koppeln“ ändert er sich)."
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
      if (data.display_id && data.device_token && data.installation_id) {
        saveDisplayDeviceCredential(
          {
            displayId: data.display_id,
            token: data.device_token,
            installationId: data.installation_id,
          },
          data.restaurant?.slug,
        );
      }
      paired = true;
      setSuccess({
        slug: data.restaurant?.slug ?? "",
        restaurantName: data.restaurant?.name,
        accentHex: data.restaurant?.accent_hex ?? null,
      });
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      if (!paired) setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (codeFromUrl) setCode(codeFromUrl);
  }, [codeFromUrl]);

  useEffect(() => {
    const normalized = normalizeDisplayPairingCode(code);
    if (!normalized) {
      autoPairAttemptRef.current = null;
      return;
    }
    if (busy || success || autoPairAttemptRef.current === normalized) return;
    autoPairAttemptRef.current = normalized;
    void pair(normalized);
  }, [code, busy, success, pair]);

  useEffect(() => {
    if (!success?.slug) return;
    const delayMs = displayPairSuccessNavigateDelayMs(reduceMotion);
    const timer = window.setTimeout(() => {
      router.replace(`/display/${success.slug}`);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [success, reduceMotion, router]);

  const handleInputChange = (value: string) => {
    const parsed = parseDisplayPairingInput(value);
    if (parsed) {
      setCode(parsed);
      return;
    }
    setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8));
  };

  return (
    <>
      <DisplayPairSuccessCelebration
        open={Boolean(success)}
        restaurantName={success?.restaurantName}
        accentHex={success?.accentHex}
      />

      <AnimatePresence mode="wait">
        {!success ? (
          <motion.div
            key="pair-form"
            className={displayChromeShellClassName}
            initial={{ opacity: 1, scale: 1 }}
            exit={{
              opacity: 0,
              scale: reduceMotion ? 1 : 0.98,
              filter: reduceMotion ? "none" : "blur(4px)",
            }}
            transition={{ duration: reduceMotion ? 0.1 : 0.35, ease: MOTION_EASE_OUT }}
          >
            <DisplayChromeHeader>
              <span className="text-sm font-medium text-foreground">Display koppeln</span>
            </DisplayChromeHeader>
            <main
              className={cn(
                displayChromeMainClassName,
                "flex flex-col items-center justify-center gap-8 p-6",
              )}
            >
            <div className="max-w-md space-y-2 text-center">
              <p className="text-muted-foreground">
                QR-Code scannen, Kopplungslink öffnen oder 8-stelligen Code eingeben —
                bei gültigem Code verbindet sich das Tablet automatisch.
              </p>
            </div>

            <div className="flex w-full max-w-sm flex-col gap-4">
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                value={code}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="Code oder Link"
                disabled={busy}
                className="h-16 rounded-2xl border border-input bg-background px-4 text-center text-2xl font-semibold tracking-[0.3em] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              />
              {error ? (
                <p className="text-center text-sm text-destructive">{error}</p>
              ) : null}
              <Button
                size="lg"
                className={cn("h-14 text-lg", brandActionButtonRoundedClassName)}
                disabled={busy || !normalizeDisplayPairingCode(code)}
                onClick={() => {
                  autoPairAttemptRef.current = null;
                  void pair(code);
                }}
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
            </main>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
