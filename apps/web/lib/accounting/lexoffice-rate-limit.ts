/** Gemeinsame Erkennung von Lexware-Rate-Limit-Fehlern (Client + Server). */
export function isLexofficeRateLimitError(
  message: string | null | undefined,
): boolean {
  if (!message) return false;
  return message.includes("Rate-Limit") || message.includes("429");
}
