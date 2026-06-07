"use client";

import { useLayoutEffect } from "react";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import {
  accentCssVariableStyle,
  applyAccentToDocument,
  normalizeHex,
} from "@/lib/theme/color-utils";

/** Restaurant-Akzent auf Display-Routen — geerbte Variablen + :root (Portale). */
export function DisplayAccentRoot({
  accentHex,
  children,
}: {
  accentHex: string | null | undefined;
  children: React.ReactNode;
}) {
  const resolved = normalizeHex(accentHex ?? "") ?? DEFAULT_ACCENT_HEX;

  useLayoutEffect(() => {
    applyAccentToDocument(resolved);
  }, [resolved]);

  return (
    <div
      className="min-h-dvh bg-background text-foreground"
      style={accentCssVariableStyle(resolved)}
    >
      {children}
    </div>
  );
}
