"use client";

import { Check, X } from "lucide-react";
import {
  getPasswordStrengthLevel,
  PASSWORD_REQUIREMENT_ITEMS,
  passwordStrengthBarClassName,
  passwordStrengthBarWidth,
  passwordStrengthLabel,
  passwordStrengthLabelClassName,
} from "@/lib/auth/password-policy";
import { cn } from "@/lib/utils";

type PasswordStrengthBarProps = {
  password: string;
  className?: string;
  showRequirements?: boolean;
};

export function PasswordStrengthBar({
  password,
  className,
  showRequirements = true,
}: PasswordStrengthBarProps) {
  const level = getPasswordStrengthLevel(password);
  const hasPassword = password.length > 0;
  const label = passwordStrengthLabel(level);

  if (!hasPassword && !showRequirements) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {hasPassword ? (
        <div className="space-y-1.5" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Passwortstärke</span>
            <span
              className={cn(
                "text-xs font-medium transition-colors duration-300",
                passwordStrengthLabelClassName(level),
              )}
            >
              {label}
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Number.parseInt(passwordStrengthBarWidth(password), 10)}
            aria-valuetext={label}
            aria-label="Passwortstärke"
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width,background-color] duration-300 ease-out",
                passwordStrengthBarClassName(level),
              )}
              style={{ width: passwordStrengthBarWidth(password) }}
            />
          </div>
        </div>
      ) : null}

      {showRequirements ? (
        <ul className="grid gap-1 sm:grid-cols-2" aria-live="polite">
          {PASSWORD_REQUIREMENT_ITEMS.map((item) => {
            const met = item.test(password);
            return (
              <li
                key={item.key}
                className={cn(
                  "flex items-center gap-1.5 text-xs transition-colors",
                  met
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground",
                )}
              >
                {met ? (
                  <Check className="size-3.5 shrink-0" aria-hidden />
                ) : (
                  <X className="size-3.5 shrink-0 opacity-70" aria-hidden />
                )}
                <span>{item.label}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
