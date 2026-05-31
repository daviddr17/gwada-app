/** Einheitlicher Cookie-Name — unabhängig von `/sb`-Proxy-URL (sonst abweichende Storage-Keys). */
export const gwadaSupabaseCookieOptions = {
  name: "sb-gwada-auth",
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
