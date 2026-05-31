import "server-only";

const BUCKET = "platform-branding";

export function platformBrandingPublicObjectUrl(
  storagePath: string | null | undefined,
): string | null {
  const path = storagePath?.trim();
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!base) return null;
  const encoded = path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${base}/storage/v1/object/public/${BUCKET}/${encoded}`;
}
