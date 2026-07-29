/**
 * OpenSSH/PEM Private Keys brauchen echte Zeilenumbrüche nach BEGIN/END.
 * UI-Softwrap ist ok — aber manchmal landet alles in einer Zeile oder mit \\n.
 * Alternativ: Base64 der kompletten PEM (eine Zeile, robuster beim Copy/Paste).
 */
export function normalizeSshPrivateKey(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) return "";

  text = text.replace(/\\n/g, "\n").trim();

  if (!text.includes("BEGIN") && /^[A-Za-z0-9+/=\s]+$/.test(text)) {
    try {
      const decoded = Buffer.from(text.replace(/\s+/g, ""), "base64").toString(
        "utf8",
      );
      if (decoded.includes("BEGIN") && decoded.includes("PRIVATE KEY")) {
        text = decoded.trim();
      }
    } catch {
      /* keep raw */
    }
  }

  if (!text.includes("BEGIN") || !text.includes("PRIVATE KEY")) {
    return text;
  }

  // Alles in einer Zeile → PEM-Zeilen wiederherstellen
  if (!text.includes("\n")) {
    const begin = text.match(/^-----BEGIN [^-]+-----/);
    const end = text.match(/-----END [^-]+-----$/);
    if (begin && end) {
      const body = text.slice(begin[0].length, text.length - end[0].length);
      const chunks = body.match(/.{1,70}/g) ?? [];
      text = [begin[0], ...chunks, end[0]].join("\n");
    }
  }

  return `${text.trim()}\n`;
}
