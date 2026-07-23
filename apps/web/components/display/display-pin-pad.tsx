"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Delete, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DISPLAY_PIN_REJECT_MS,
  DISPLAY_PIN_REJECT_REDUCED_MS,
  DISPLAY_PIN_REVEAL_MS,
  DISPLAY_PIN_REVEAL_REDUCED_MS,
  MOTION_EASE_OUT,
} from "@/lib/ui/motion-presets";
import { cn } from "@/lib/utils";
import { DisplayPinStandbyScene } from "@/components/display/display-pin-standby";

type DisplayPinPadProps = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (pin: string) => void;
  maxLength?: number;
  disabled?: boolean;
  /** Während PIN geprüft wird — Punkte pulsieren dezent. */
  busy?: boolean;
  /** Bei jeder falschen PIN erhöhen — löst Shake + Rot-Flash aus. */
  rejectNonce?: number;
  className?: string;
};

const PIN_REJECT_SHAKE_X = [0, -14, 14, -10, 10, -5, 5, 0];

export function DisplayPinPad({
  value,
  onChange,
  onComplete,
  maxLength = 4,
  disabled = false,
  busy = false,
  rejectNonce = 0,
  className,
}: DisplayPinPadProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const lastCompleteRef = useRef<string | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [rejectActive, setRejectActive] = useState(false);

  useEffect(() => {
    if (rejectNonce <= 0) return;
    setRejectActive(true);
    const ms = reduceMotion
      ? DISPLAY_PIN_REJECT_REDUCED_MS
      : DISPLAY_PIN_REJECT_MS;
    const id = window.setTimeout(() => setRejectActive(false), ms);
    return () => window.clearTimeout(id);
  }, [rejectNonce, reduceMotion]);

  useEffect(() => {
    if (value.length === maxLength && value !== lastCompleteRef.current) {
      lastCompleteRef.current = value;
      onComplete?.(value);
    }
    if (value.length < maxLength) {
      lastCompleteRef.current = null;
    }
  }, [value, maxLength, onComplete]);

  const pushDigit = (digit: string) => {
    if (disabled || busy || value.length >= maxLength) return;
    onChange(value + digit);
  };

  const backspace = () => {
    if (disabled || busy) return;
    onChange(value.slice(0, -1));
  };

  useEffect(() => {
    if (disabled || busy) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const digit =
        event.key.length === 1 && event.key >= "0" && event.key <= "9"
          ? event.key
          : null;

      if (digit) {
        event.preventDefault();
        const current = valueRef.current;
        if (current.length >= maxLength) return;
        onChange(current + digit);
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        onChange(valueRef.current.slice(0, -1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, busy, maxLength, onChange]);

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  /** Skaliert mit Viewport-Höhe — kurze Tablets behalten Abstand zu Header/Footer. */
  const keySizeClassName =
    "h-[clamp(2.75rem,min(18vw,9dvh),5rem)] w-[clamp(2.75rem,min(18vw,9dvh),5rem)] p-0";
  const keyClassName = cn(
    keySizeClassName,
    "rounded-full border-border/60 shadow-sm",
  );
  const keyDigitClassName = cn(
    keyClassName,
    "text-[clamp(1.35rem,4.2dvh,1.875rem)] font-semibold",
  );

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-[clamp(0.875rem,3dvh,2rem)]",
        className,
      )}
      role="group"
      aria-label="PIN-Eingabe. Zifferntasten der Tastatur werden ebenfalls akzeptiert."
      aria-busy={busy}
    >
      <motion.div
        className="flex gap-[clamp(0.75rem,2dvh,1.25rem)]"
        aria-hidden
        animate={
          rejectActive && !reduceMotion
            ? { x: PIN_REJECT_SHAKE_X }
            : { x: 0 }
        }
        transition={
          rejectActive && !reduceMotion
            ? { duration: DISPLAY_PIN_REJECT_MS / 1000, ease: MOTION_EASE_OUT }
            : { duration: 0 }
        }
      >
        {Array.from({ length: maxLength }).map((_, i) => {
          const filled = i < value.length;
          return (
            <motion.div
              key={i}
              className={cn(
                "size-[clamp(1.1rem,2.6dvh,1.75rem)] rounded-full border-[3px]",
                rejectActive
                  ? "border-destructive bg-destructive/15"
                  : filled
                    ? "border-accent bg-accent"
                    : "border-muted-foreground/35 bg-muted/30",
              )}
              animate={{
                scale:
                  busy && filled && !rejectActive
                    ? [1, 1.06, 1]
                    : filled && !rejectActive
                      ? 1.12
                      : rejectActive
                        ? [1, 1.08, 1]
                        : 1,
                opacity:
                  busy && filled && !rejectActive ? [1, 0.78, 1] : 1,
              }}
              transition={
                busy && filled && !rejectActive
                  ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" }
                  : rejectActive
                    ? { duration: DISPLAY_PIN_REJECT_MS / 1000, ease: MOTION_EASE_OUT }
                    : { type: "spring", stiffness: 520, damping: 32, mass: 0.65 }
              }
            />
          );
        })}
      </motion.div>

      <motion.div
        className="grid w-full max-w-[min(19rem,72vw)] grid-cols-3 place-items-center gap-[clamp(0.5rem,1.8dvh,1.25rem)]"
        animate={
          rejectActive && !reduceMotion
            ? { x: PIN_REJECT_SHAKE_X }
            : { x: 0 }
        }
        transition={
          rejectActive && !reduceMotion
            ? { duration: DISPLAY_PIN_REJECT_MS / 1000, ease: MOTION_EASE_OUT }
            : { duration: 0 }
        }
      >
        {digits.map((d, idx) => {
          if (d === "") {
            return <div key={`empty-${idx}`} className={keySizeClassName} />;
          }
          if (d === "del") {
            return (
              <Button
                key="del"
                type="button"
                variant="outline"
                className={keyClassName}
                disabled={disabled || busy || value.length === 0}
                onClick={backspace}
                aria-label="Löschen"
              >
                <Delete className="size-[clamp(1.25rem,3.2dvh,1.75rem)]" />
              </Button>
            );
          }
          return (
            <Button
              key={d}
              type="button"
              variant="outline"
              className={keyDigitClassName}
              disabled={disabled || busy}
              onClick={() => pushDigit(d)}
            >
              {d}
            </Button>
          );
        })}
      </motion.div>
    </div>
  );
}

export function DisplayLockOverlay({
  open,
  onUnlock,
  busy,
  error,
  accentHex,
  /** `content` = nur Header/Hauptbereich; Fußzeile bleibt sichtbar. */
  placement = "fullscreen",
}: {
  open: boolean;
  onUnlock: (pin: string) => void;
  busy?: boolean;
  error?: string | null;
  accentHex: string;
  placement?: "fullscreen" | "content";
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const [pin, setPin] = useState("");
  const [rejectNonce, setRejectNonce] = useState(0);

  useEffect(() => {
    if (open) {
      setPin("");
      setRejectNonce(0);
    }
  }, [open]);

  useEffect(() => {
    if (!error) return;
    setRejectNonce((value) => value + 1);
  }, [error]);

  const revealMs = reduceMotion ? DISPLAY_PIN_REVEAL_REDUCED_MS : DISPLAY_PIN_REVEAL_MS;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="display-lock"
          className={cn(
            "overflow-hidden",
            placement === "content"
              ? "absolute inset-0 z-40 flex min-h-0 flex-col"
              : "fixed inset-0 z-50 flex flex-col",
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: revealMs / 1000, ease: MOTION_EASE_OUT }}
        >
          <DisplayPinStandbyScene
            accentHex={accentHex}
            enabled={open}
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Lock className="size-5" />
              <span className="text-lg">Display gesperrt</span>
            </div>
            <p className="text-sm text-muted-foreground">PIN eingeben</p>
            <DisplayPinPad
              value={pin}
              onChange={setPin}
              onComplete={onUnlock}
              disabled={busy}
              busy={busy}
              rejectNonce={rejectNonce}
            />
            {error ? (
              <motion.p
                key={error}
                className="text-sm text-destructive"
                initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0.08 : 0.22, ease: MOTION_EASE_OUT }}
              >
                {error}
              </motion.p>
            ) : null}
          </DisplayPinStandbyScene>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
