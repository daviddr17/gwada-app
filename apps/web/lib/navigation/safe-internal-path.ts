/** Nach Login: nur interne Pfade (kein Open-Redirect). */
export function safeInternalPath(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== "string") return "/dashboard";
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return "/dashboard";
  if (t.includes("\0")) return "/dashboard";
  if (t === "/") return "/dashboard";
  return t;
}
