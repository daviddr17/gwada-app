"use client";

import { useId, useState } from "react";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";

/** Anzeige für „bereits gespeichert“ — nicht der echte Secret-Wert. */
export const SECRET_STORED_MASK = "••••••••••••••••";

type SecretInputProps = {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  configured?: boolean;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  className?: string;
  inputClassName?: string;
};

/**
 * Passwort-/API-Key-Feld: gespeicherte Secrets werden nie aus der DB geladen.
 * Stattdessen Maskierung + optional Sichtbarkeit nur für neu eingegebenen Text.
 */
export function SecretInput({
  id: idProp,
  label,
  value,
  onChange,
  configured = false,
  disabled,
  placeholder,
  hint,
  className,
  inputClassName,
}: SecretInputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [editing, setEditing] = useState(false);

  const showingStoredMask = configured && !editing && value.length === 0;
  const inputValue = showingStoredMask ? SECRET_STORED_MASK : value;
  const canToggleVisibility = !showingStoredMask && value.length > 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </Label>
        {configured && !editing && value.length === 0 ? (
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Hinterlegt
          </span>
        ) : null}
      </div>
      <PasswordInput
        id={id}
        disabled={disabled}
        readOnly={showingStoredMask}
        value={inputValue}
        placeholder={placeholder}
        canToggleVisibility={canToggleVisibility}
        className={cn(
          "h-11 rounded-xl font-mono text-sm",
          showingStoredMask && "text-muted-foreground",
          inputClassName,
        )}
        spellCheck={false}
        autoComplete="new-password"
        onFocus={() => {
          if (showingStoredMask) {
            onChange("");
            setEditing(true);
          }
        }}
        onChange={(e) => {
          setEditing(true);
          onChange(e.target.value);
        }}
        onBlur={() => {
          if (value.length === 0 && configured) {
            setEditing(false);
          }
        }}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
