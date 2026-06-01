import "server-only";

const BUCKET = "platform-branding";

/** Relativer Pfad über App-Proxy — gleiche Origin wie die App (localhost vs. 127.0.0.1). */
export function platformBrandingPublicObjectPath(
  storagePath: string | null | undefined,
): string | null {
  const path = storagePath?.trim();
  if (!path) return null;
  const encoded = path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `/sb/storage/v1/object/public/${BUCKET}/${encoded}`;
}

/** Öffentliche Branding-Asset-URL für Browser, Metadata und API-Responses. */
export function platformBrandingPublicObjectUrl(
  storagePath: string | null | undefined,
): string | null {
  return platformBrandingPublicObjectPath(storagePath);
}
