"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Delete, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DISPLAY_PIN_REVEAL_MS,
  DISPLAY_PIN_REVEAL_REDUCED_MS,
  MOTION_EASE_OUT,
} from "@/lib/ui/motion-presets";
import { cn } from "@/lib/utils";

type DisplayPinPadProps = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (pin: string) => void;
  maxLength?: number;
  disabled?: boolean;
  /** Während PIN geprüft wird — Punkte pulsieren dezent. */
  busy?: boolean;
  className?: string;
};

export function DisplayPinPad({
  value,
  onChange,
  onComplete,
  maxLength = 4,
  disabled = false,
  busy = false,
  className,
}: DisplayPinPadProps) {
  const lastCompleteRef = useRef<string | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

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

  return (
    <div
      className={cn("flex flex-col items-center gap-8", className)}
      role="group"
      aria-label="PIN-Eingabe. Zifferntasten der Tastatur werden ebenfalls akzeptiert."
      aria-busy={busy}
    >
      <div className="flex gap-5" aria-hidden>
        {Array.from({ length: maxLength }).map((_, i) => (
          <motion.div
            key={i}
            className={cn(
              "size-7 rounded-full border-[3px]",
              i < value.length
                ? "border-accent bg-accent shadow-sm"
                : "border-muted-foreground/35 bg-muted/30",
            )}
            animate={
              busy && i < value.length
                ? { scale: [1, 1.08, 1], opacity: [1, 0.72, 1] }
                : { scale: i < value.length ? 1.1 : 1, opacity: 1 }
            }
            transition={
              busy && i < value.length
                ? { duration: 0.85, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.2, ease: MOTION_EASE_OUT }
            }
          />
        ))}
      </div>

      <div className="grid w-full max-w-[17rem] grid-cols-3 place-items-center gap-4 sm:max-w-[19rem] sm:gap-5">
        {digits.map((d, idx) => {
          if (d === "") {
            return <div key={`empty-${idx}`} className="size-[4.5rem] sm:size-20" />;
          }
          if (d === "del") {
            return (
              <Button
                key="del"
                type="button"
                variant="outline"
                className="size-[4.5rem] rounded-full border-border/60 text-lg shadow-sm sm:size-20"
                disabled={disabled || busy || value.length === 0}
                onClick={backspace}
                aria-label="Löschen"
              >
                <Delete className="size-7" />
              </Button>
            );
          }
          return (
            <Button
              key={d}
              type="button"
              variant="outline"
              className="size-[4.5rem] rounded-full border-border/60 text-3xl font-semibold shadow-sm sm:size-20"
              disabled={disabled || busy}
              onClick={() => pushDigit(d)}
            >
              {d}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function DisplayLockOverlay({
  open,
  onUnlock,
  busy,
  error,
  /** `content` = nur Header/Hauptbereich; Fußzeile bleibt sichtbar. */
  placement = "fullscreen",
}: {
  open: boolean;
  onUnlock: (pin: string) => void;
  busy?: boolean;
  error?: string | null;
  placement?: "fullscreen" | "content";
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (open) setPin("");
  }, [open]);

  const revealMs = reduceMotion ? DISPLAY_PIN_REVEAL_REDUCED_MS : DISPLAY_PIN_REVEAL_MS;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="display-lock"
          className={cn(
            "flex flex-col items-center justify-center gap-6 bg-background/95 p-6 backdrop-blur-sm",
            placement === "content"
              ? "absolute inset-0 z-40"
              : "fixed inset-0 z-50",
          )}
          initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
          animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
          exit={{
            opacity: 0,
            backdropFilter: "blur(0px)",
            scale: reduceMotion ? 1 : 1.02,
          }}
          transition={{ duration: revealMs / 1000, ease: MOTION_EASE_OUT }}
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
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
