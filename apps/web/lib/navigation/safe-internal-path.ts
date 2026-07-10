const LEGACY_POST_LOGIN_PATH_ALIASES: Readonly<Record<string, string>> = {
  "/dashboard/overview": "/dashboard",
};

/** Nach Login: nur interne Pfade (kein Open-Redirect). */
export function safeInternalPath(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== "string") return "/dashboard";
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return "/dashboard";
  if (t.includes("\0")) return "/dashboard";
  if (t === "/") return "/dashboard";
  const withoutQuery = t.split("?")[0]?.split("#")[0] ?? t;
  return LEGACY_POST_LOGIN_PATH_ALIASES[withoutQuery] ?? t;
}
