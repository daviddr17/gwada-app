/** 8-stelliger Kopplungscode (Großbuchstaben/Ziffern, ohne 0/O/1/I). */
export function normalizeDisplayPairingCode(raw: string): string | null {
  const code = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length === 8 ? code : null;
}

/** Rohtext, URL oder Pfad → Kopplungscode. */
export function parseDisplayPairingInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const direct = normalizeDisplayPairingCode(trimmed);
  if (direct) return direct;

  const fromQuery = trimmed.match(/[?&]code=([A-Za-z0-9]{8})/i);
  if (fromQuery) return normalizeDisplayPairingCode(fromQuery[1]!);

  try {
    const url = trimmed.startsWith("/")
      ? new URL(trimmed, "https://gwada.local")
      : new URL(trimmed);
    const code = url.searchParams.get("code");
    if (code) return normalizeDisplayPairingCode(code);
  } catch {
    /* kein URL-Format */
  }

  return null;
}
