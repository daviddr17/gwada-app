import type { InputHTMLAttributes } from "react";

/** `inputMode` für Personenanzahl, Verweildauer usw. auf Tablet/Mobil. */
export function touchNumericInputMode(
  touchTablet: boolean,
): InputHTMLAttributes<HTMLInputElement>["inputMode"] {
  return touchTablet ? "numeric" : undefined;
}

/** Telefon-Lokalteil: reines Nummernfeld statt Telefon-Tastatur. */
export function touchPhoneLocalInputMode(
  touchTablet: boolean,
): "tel" | "numeric" | undefined {
  return touchTablet ? "numeric" : "tel";
}
