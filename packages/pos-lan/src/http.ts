export type PosLanHttpRequest = {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string;
};

export type PosLanHttpResponse = {
  status: number;
  headers?: Record<string, string>;
  body: string;
};

/**
 * Minimaler HTTP/1.1-Request-Parser für den Hub-TCP-Server
 * (kein Chunked Encoding, Content-Length oder EOF).
 */
export function tryParseHttpRequest(
  raw: string,
): { request: PosLanHttpRequest; consumed: number } | null {
  const headerEnd = raw.indexOf("\r\n\r\n");
  if (headerEnd === -1) return null;

  const head = raw.slice(0, headerEnd);
  const lines = head.split("\r\n");
  const requestLine = lines[0];
  if (!requestLine) return null;

  const parts = requestLine.split(" ");
  if (parts.length < 2) return null;
  const method = (parts[0] ?? "GET").toUpperCase();
  const pathWithQuery = parts[1] ?? "/";
  const path = pathWithQuery.split("?")[0] ?? "/";

  const headers: Record<string, string> = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    headers[key] = value;
  }

  const contentLength = Number(headers["content-length"] ?? "0");
  if (!Number.isFinite(contentLength) || contentLength < 0) return null;

  const bodyStart = headerEnd + 4;
  const totalNeeded = bodyStart + contentLength;
  if (raw.length < totalNeeded) return null;

  return {
    request: {
      method,
      path,
      headers,
      body: raw.slice(bodyStart, totalNeeded),
    },
    consumed: totalNeeded,
  };
}

function utf8ByteLength(value: string): number {
  let n = 0;
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0x7f) n += 1;
    else if (code <= 0x7ff) n += 2;
    else if (code <= 0xffff) n += 3;
    else n += 4;
  }
  return n;
}

export function serializeHttpResponse(res: PosLanHttpResponse): string {
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    connection: "close",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    ...(res.headers ?? {}),
  };
  headers["content-length"] = String(utf8ByteLength(res.body));

  const statusText =
    res.status === 200
      ? "OK"
      : res.status === 204
        ? "No Content"
        : res.status === 404
          ? "Not Found"
          : res.status === 405
            ? "Method Not Allowed"
            : res.status === 503
              ? "Service Unavailable"
              : "Error";

  const head = Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\r\n");

  return `HTTP/1.1 ${res.status} ${statusText}\r\n${head}\r\n\r\n${res.body}`;
}

export function jsonHttpResponse(
  status: number,
  payload: unknown,
  extraHeaders?: Record<string, string>,
): PosLanHttpResponse {
  return {
    status,
    headers: extraHeaders,
    body: JSON.stringify(payload),
  };
}
