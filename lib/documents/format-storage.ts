const NBSP = "\u00a0";

/** Größe mit geschütztem Leerzeichen (Zahl + Einheit bleiben in einer Zeile). */
export function formatStorageBytes(bytes: number): string {
  const n = Math.max(0, bytes);
  if (n < 1024) return `${n}${NBSP}B`;
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(n < 10_240 ? 1 : 0)}${NBSP}KB`;
  }
  if (n < 1024 * 1024 * 1024) {
    return `${(n / (1024 * 1024)).toFixed(n < 10_485_760 ? 1 : 0)}${NBSP}MB`;
  }
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)}${NBSP}GB`;
}
