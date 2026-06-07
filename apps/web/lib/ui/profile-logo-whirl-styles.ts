import type { CSSProperties } from "react";

function parseAccentRgb(accentHex: string): { r: number; g: number; b: number } {
  const hex = accentHex.trim().replace(/^#/, "");
  if (hex.length === 3) {
    const [r, g, b] = hex.split("").map((c) => parseInt(c + c, 16));
    return { r: r!, g: g!, b: b! };
  }
  if (hex.length === 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return { r: 99, g: 102, b: 241 };
}

/** Conic ring — rgba statt color-mix für konsistentes Safari/Chrome-Rendering. */
export function profileLogoWhirlRingStyle(accentHex: string): CSSProperties {
  const { r, g, b } = parseAccentRgb(accentHex);
  return {
    background: `conic-gradient(from 0deg, rgba(${r}, ${g}, ${b}, 0.78) 0%, transparent 32%, rgba(${r}, ${g}, ${b}, 0.52) 52%, transparent 70%, rgba(${r}, ${g}, ${b}, 0.68) 100%)`,
  };
}

export const PROFILE_LOGO_WHIRL_EASE = [0.32, 0.72, 0, 1] as const;
