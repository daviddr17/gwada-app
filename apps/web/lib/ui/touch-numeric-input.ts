import type { InputHTMLAttributes } from "react";

/** iOS-Safari: `pattern` zusammen mit `inputMode="numeric"` für Ziffernblock. */
export const TOUCH_NUMERIC_IOS_PATTERN = "[0-9]*";

type TouchNumericFieldProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  "inputMode" | "type" | "pattern" | "autoComplete" | "enterKeyHint"
>;

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

/**
 * Reines Ziffernfeld — `type="text"` + `inputMode`, nicht `type="number"`.
 * Auf iOS öffnet `type="number"` oft die Volltastatur trotz `inputMode`.
 */
export function touchNumericInputProps(
  touchTablet: boolean,
): TouchNumericFieldProps {
  if (!touchTablet) return {};
  return {
    type: "text",
    inputMode: "numeric",
    pattern: TOUCH_NUMERIC_IOS_PATTERN,
    autoComplete: "off",
    enterKeyHint: "done",
  };
}

/** Display-Zone (Tablet-Kiosk): immer numerische Tastatur. */
export const displayTouchNumericInputProps: TouchNumericFieldProps =
  touchNumericInputProps(true);

export const displayTouchPhoneLocalInputMode = "numeric" as const;

export function digitsOnlyInput(raw: string, maxLength?: number): string {
  const digits = raw.replace(/\D/g, "");
  return maxLength != null ? digits.slice(0, maxLength) : digits;
}
