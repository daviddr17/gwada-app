import { cn } from "@/lib/utils";

/**
 * Primäre Tenant-Aktionen (Speichern, Absenden, Neu anlegen): weiches Akzent-Tint
 * auf Kartenfarbe — besserer Kontrast als Vollfläche `bg-accent`, Apple-like.
 * Farben: `--brand-action-*` in globals.css (reagiert auf Restaurant-Branding).
 */
export const brandActionButtonClassName = cn(
  "brand-action-button tap-scale",
);

/** Submit/Speichern in Formularen und Sheets (rounded-xl). */
export const brandActionButtonRoundedClassName = cn(
  brandActionButtonClassName,
  "rounded-xl",
);

/** Große „Neu anlegen“-CTA über Listen (rounded-full, mit Plus-Icon). */
export const brandActionButtonPillClassName = cn(
  brandActionButtonClassName,
  "h-12 gap-2 rounded-full px-6 dark:shadow-sm",
);

/** @deprecated Alias — bitte `brandActionButtonClassName` nutzen. */
export const settingsAccentSaveButtonClassName = brandActionButtonClassName;
