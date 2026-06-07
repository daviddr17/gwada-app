import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import {
  accentCssVariableStyle,
  normalizeHex,
} from "@/lib/theme/color-utils";

/** Server-seitiges Akzent-Wrapper — kein Client-Hydration-Overhead. */
export function DisplayAccentShell({
  accentHex,
  children,
}: {
  accentHex: string | null | undefined;
  children: React.ReactNode;
}) {
  const resolved = normalizeHex(accentHex ?? "") ?? DEFAULT_ACCENT_HEX;

  return (
    <div
      className="h-dvh overflow-hidden bg-background text-foreground"
      style={accentCssVariableStyle(resolved)}
    >
      {children}
    </div>
  );
}
