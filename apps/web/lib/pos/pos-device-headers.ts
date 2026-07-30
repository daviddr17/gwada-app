/** Native POS sends device/session as headers (no httpOnly cookies). */

export const POS_DEVICE_HEADER = "x-gwada-pos-device";
export const POS_SESSION_HEADER = "x-gwada-pos-session";

export type ParsedPosDeviceHeader = {
  deviceId: string;
  token: string;
};

export type ParsedPosSessionHeader = {
  sessionId: string;
  token: string;
};

export function formatPosDeviceHeader(deviceId: string, token: string): string {
  return `${deviceId}.${token}`;
}

export function formatPosSessionHeader(sessionId: string, token: string): string {
  return `${sessionId}.${token}`;
}

export function parsePosDeviceHeader(
  value: string | null | undefined,
): ParsedPosDeviceHeader | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const deviceId = value.slice(0, dot).trim();
  const token = value.slice(dot + 1).trim();
  if (!deviceId || !token) return null;
  return { deviceId, token };
}

export function parsePosSessionHeader(
  value: string | null | undefined,
): ParsedPosSessionHeader | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const sessionId = value.slice(0, dot).trim();
  const token = value.slice(dot + 1).trim();
  if (!sessionId || !token) return null;
  return { sessionId, token };
}
