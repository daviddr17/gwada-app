export const DISPLAY_DEVICE_COOKIE = "gwada-display-device";
export const DISPLAY_SESSION_COOKIE = "gwada-display-session";

export type ParsedDisplayDeviceCookie = {
  displayId: string;
  token: string;
};

export type ParsedDisplaySessionCookie = {
  sessionId: string;
  token: string;
};

export function formatDisplayDeviceCookie(displayId: string, token: string): string {
  return `${displayId}.${token}`;
}

export function formatDisplaySessionCookie(sessionId: string, token: string): string {
  return `${sessionId}.${token}`;
}

export function parseDisplayDeviceCookie(
  value: string | undefined,
): ParsedDisplayDeviceCookie | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const displayId = value.slice(0, dot);
  const token = value.slice(dot + 1);
  if (!displayId || !token) return null;
  return { displayId, token };
}

export function parseDisplaySessionCookie(
  value: string | undefined,
): ParsedDisplaySessionCookie | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const sessionId = value.slice(0, dot);
  const token = value.slice(dot + 1);
  if (!sessionId || !token) return null;
  return { sessionId, token };
}

export const displayCookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
