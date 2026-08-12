/** Sicherer Anhang-Download: nie HTML/JSON als Datei speichern. */

function isRejectedDownloadMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return (
    m.startsWith("text/html") ||
    m.startsWith("application/json") ||
    m.startsWith("text/plain")
  );
}

async function sniffRejectsHtml(blob: Blob): Promise<boolean> {
  const sample = new Uint8Array(await blob.slice(0, 96).arrayBuffer());
  const start = String.fromCharCode(...sample).trimStart().toLowerCase();
  return (
    start.startsWith("<!doctype") ||
    start.startsWith("<html") ||
    start.startsWith("<head") ||
    start.startsWith("{")
  );
}

function filenameFromResponse(
  res: Response,
  fallback: string,
): string {
  const header = res.headers.get("X-Gwada-Filename");
  if (header) {
    try {
      const decoded = decodeURIComponent(header);
      if (decoded.trim()) return decoded.trim();
    } catch {
      /* ignore */
    }
  }
  const cd = res.headers.get("Content-Disposition") ?? "";
  const utf8 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cd);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      /* ignore */
    }
  }
  const plain = /filename\s*=\s*"([^"]+)"/i.exec(cd);
  if (plain?.[1]?.trim()) return plain[1].trim();
  return fallback;
}

export async function downloadContactAttachmentClient(params: {
  url: string;
  fileName: string;
}): Promise<{ ok: true; fileName: string } | { ok: false; error: string }> {
  const url = params.url.trim();
  if (!url) return { ok: false, error: "missing_url" };

  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "*/*" },
    });
  } catch {
    return { ok: false, error: "network" };
  }

  if (!res.ok) {
    return { ok: false, error: `http_${res.status}` };
  }

  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (isRejectedDownloadMime(mime)) {
    return { ok: false, error: "invalid_media" };
  }

  const blob = await res.blob();
  if (blob.size === 0) return { ok: false, error: "empty" };
  if (await sniffRejectsHtml(blob)) {
    return { ok: false, error: "invalid_media" };
  }

  const fileName = filenameFromResponse(res, params.fileName || "Datei");
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  return { ok: true, fileName };
}
