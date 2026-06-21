"use client";

import { useEffect, useRef, useState } from "react";
import { Delete, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DisplayPinPadProps = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (pin: string) => void;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
};

export function DisplayPinPad({
  value,
  onChange,
  onComplete,
  maxLength = 4,
  disabled = false,
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
    if (disabled || value.length >= maxLength) return;
    onChange(value + digit);
  };

  const backspace = () => {
    if (disabled) return;
    onChange(value.slice(0, -1));
  };

  useEffect(() => {
    if (disabled) return;

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
  }, [disabled, maxLength, onChange]);

  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <div
      className={cn("flex flex-col items-center gap-8", className)}
      role="group"
      aria-label="PIN-Eingabe. Zifferntasten der Tastatur werden ebenfalls akzeptiert."
    >
      <div className="flex gap-5" aria-hidden>
        {Array.from({ length: maxLength }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "size-7 rounded-full border-[3px] transition-all duration-200",
              i < value.length
                ? "scale-110 border-accent bg-accent shadow-sm"
                : "border-muted-foreground/35 bg-muted/30",
            )}
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
                disabled={disabled || value.length === 0}
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
              disabled={disabled}
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
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (open) setPin("");
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-6 bg-background/95 p-6 backdrop-blur-sm",
        placement === "content"
          ? "absolute inset-0 z-40"
          : "fixed inset-0 z-50",
      )}
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
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
