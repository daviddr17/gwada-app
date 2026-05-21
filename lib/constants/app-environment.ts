/**
 * Lokale Entwicklung (`npm run dev`) — nicht auf Coolify-Production (`next build`).
 * Steuert z. B. den „Testumgebung“-Chip in der App-Chrome.
 */
export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === "development";
}
