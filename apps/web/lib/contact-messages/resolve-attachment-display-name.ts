/** Generische Platzhalter-Labels in Bubble/Chip (nicht der echte Dateiname). */

const GENERIC_LABELS = new Set([
  "datei",
  "anhang",
  "whatsapp-anhang",
  "bild",
  "video",
  "sprachnachricht",
]);

const displayNameCache = new Map<string, string>();

export function isGenericAttachmentDisplayName(
  fileName: string | null | undefined,
): boolean {
  const t = fileName?.trim().toLowerCase() ?? "";
  if (!t) return true;
  if (GENERIC_LABELS.has(t)) return true;
  // z. B. Datei.pdf wenn nur aus MIME geraten
  if (/^datei\.[a-z0-9]{2,8}$/i.test(t)) return true;
  return false;
}

/** Für WAHA-Proxy-URLs: echten Dateinamen per meta=1 holen (ohne Blob). */
export async function resolveWahaAttachmentDisplayName(
  mediaUrl: string,
): Promise<string | null> {
  const url = mediaUrl.trim();
  if (!url.includes("/waha/media")) return null;

  const cached = displayNameCache.get(url);
  if (cached) return cached;

  let metaUrl: URL;
  try {
    metaUrl = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://local");
  } catch {
    return null;
  }
  metaUrl.searchParams.set("meta", "1");

  try {
    const res = await fetch(metaUrl.toString(), {
      credentials: "same-origin",
      cache: "default",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { fileName?: unknown };
    const name =
      typeof data.fileName === "string" ? data.fileName.trim() : "";
    if (!name || isGenericAttachmentDisplayName(name)) return null;
    displayNameCache.set(url, name);
    return name;
  } catch {
    return null;
  }
}

export function rememberAttachmentDisplayName(
  mediaUrl: string,
  fileName: string,
): void {
  const url = mediaUrl.trim();
  const name = fileName.trim();
  if (!url || !name || isGenericAttachmentDisplayName(name)) return;
  displayNameCache.set(url, name);
}
