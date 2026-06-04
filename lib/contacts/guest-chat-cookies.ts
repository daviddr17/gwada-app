export const GUEST_CHAT_SESSION_COOKIE = "gwada-guest-chat";

export type ParsedGuestChatSessionCookie = {
  sessionId: string;
  token: string;
};

export function formatGuestChatSessionCookie(
  sessionId: string,
  token: string,
): string {
  return `${sessionId}.${token}`;
}

export function parseGuestChatSessionCookie(
  value: string | undefined,
): ParsedGuestChatSessionCookie | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const sessionId = value.slice(0, dot);
  const token = value.slice(dot + 1);
  if (!sessionId || !token) return null;
  return { sessionId, token };
}

export const guestChatCookieOptions = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
