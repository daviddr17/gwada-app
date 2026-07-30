"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  /**
   * Sichtbarkeit umschaltbar. Standard: nur wenn ein Wert eingegeben ist
   * (gespeicherte Masken/leere Felder bleiben verborgen).
   */
  canToggleVisibility?: boolean;
};

/**
 * Passwort-/Credential-Feld mit Eye-Toggle im Input.
 * Nur für die aktuelle Eingabe — gespeicherte Secrets gehören in `SecretInput`.
 */
export function PasswordInput({
  className,
  value,
  disabled,
  canToggleVisibility: canToggleVisibilityProp,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const hasValue =
    typeof value === "string"
      ? value.length > 0
      : value != null && String(value).length > 0;
  const canToggle =
    canToggleVisibilityProp ?? (!disabled && hasValue);

  useEffect(() => {
    if (!hasValue) setVisible(false);
  }, [hasValue]);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible && canToggle ? "text" : "password"}
        value={value}
        disabled={disabled}
        className={cn("pr-11", className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={!canToggle}
        tabIndex={-1}
        className="absolute right-0.5 top-1/2 size-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={
          canToggle
            ? visible
              ? "Eingabe verbergen"
              : "Eingabe anzeigen"
            : "Nichts anzuzeigen"
        }
        aria-pressed={canToggle ? visible : undefined}
        onClick={() => {
          if (canToggle) setVisible((v) => !v);
        }}
      >
        {visible && canToggle ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </Button>
    </div>
  );
}
