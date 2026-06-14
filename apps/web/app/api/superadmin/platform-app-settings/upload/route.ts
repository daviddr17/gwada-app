import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import {
  isPlatformBrandingAssetKind,
  PLATFORM_BRANDING_ASSET_FIELDS,
} from "@/lib/superadmin/platform-branding-asset-kind";
import {
  isSvgLogoMime,
  optimizeLogoBufferForStorage,
} from "@/lib/platform/platform-logo-optimize";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  fetchPlatformAppBranding,
  fetchSidebarModuleOrder,
  updatePlatformBrandingAssetPath,
} from "@/lib/supabase/platform-app-settings-db";
import type { PlatformBrandingAssetKind } from "@/lib/types/platform-app-settings";

export const dynamic = "force-dynamic";

const BUCKET = "platform-branding";
const MAX_BYTES = 2 * 1024 * 1024;
const LOGO_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);
const FAVICON_MIMES = new Set([
  ...LOGO_MIMES,
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

function extForMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    case "image/x-icon":
    case "image/vnd.microsoft.icon":
      return "ico";
    default:
      return "bin";
  }
}

async function jsonBranding(
  admin: NonNullable<Awaited<ReturnType<typeof createSupabaseAdminClient>>>,
) {
  const branding = await fetchPlatformAppBranding(admin);
  const sidebarModuleOrder = await fetchSidebarModuleOrder(admin);
  return Response.json({
    appName: branding.appName,
    logoUrl: branding.logoUrl,
    logoDarkUrl: branding.logoDarkUrl,
    faviconUrl: branding.faviconUrl,
    logoPath: branding.logoPath,
    logoDarkPath: branding.logoDarkPath,
    faviconPath: branding.faviconPath,
    sidebarModuleOrder,
  });
}

function prevPathForKind(
  current: Awaited<ReturnType<typeof fetchPlatformAppBranding>>,
  kind: PlatformBrandingAssetKind,
): string | null {
  switch (kind) {
    case "logo":
      return current.logoPath;
    case "logo_dark":
      return current.logoDarkPath;
    case "favicon":
      return current.faviconPath;
  }
}

async function removeStorageObject(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  path: string | null | undefined,
) {
  const p = path?.trim();
  if (!p) return;
  await admin.storage.from(BUCKET).remove([p]);
}

export async function POST(req: Request) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const kindRaw = form?.get("kind");
  const file = form?.get("file");
  const kind =
    typeof kindRaw === "string" && isPlatformBrandingAssetKind(kindRaw)
      ? kindRaw
      : null;
  if (!kind || !(file instanceof File)) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const allowed = kind === "favicon" ? FAVICON_MIMES : LOGO_MIMES;
  if (!allowed.has(file.type) || file.size > MAX_BYTES) {
    return Response.json({ error: "invalid_file" }, { status: 400 });
  }

  const current = await fetchPlatformAppBranding(admin);
  const prevPath = prevPathForKind(current, kind);
  const { dbField, storagePrefix } = PLATFORM_BRANDING_ASSET_FIELDS[kind];

  const ext = extForMime(file.type);
  const storagePath = `${storagePrefix}-${Date.now()}.${ext}`;
  let bytes = new Uint8Array(await file.arrayBuffer());
  let uploadContentType = file.type;

  if (
    (kind === "logo" || kind === "logo_dark") &&
    !isSvgLogoMime(file.type)
  ) {
    const optimized = await optimizeLogoBufferForStorage(Buffer.from(bytes));
    bytes = new Uint8Array(optimized.buffer);
    uploadContentType = optimized.contentType;
    const storagePathWebp = `${storagePrefix}-${Date.now()}.webp`;
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(storagePathWebp, bytes, {
        contentType: uploadContentType,
        upsert: true,
      });

    if (uploadError) {
      return Response.json({ error: uploadError.message }, { status: 500 });
    }

    const { error: updateError } = await updatePlatformBrandingAssetPath(
      admin,
      dbField,
      storagePathWebp,
    );

    if (updateError) {
      await admin.storage.from(BUCKET).remove([storagePathWebp]);
      return Response.json({ error: updateError }, { status: 500 });
    }

    await removeStorageObject(admin, prevPath);
    return jsonBranding(admin);
  }

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, {
      contentType: uploadContentType,
      upsert: true,
    });

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const { error: updateError } = await updatePlatformBrandingAssetPath(
    admin,
    dbField,
    storagePath,
  );

  if (updateError) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return Response.json({ error: updateError }, { status: 500 });
  }

  await removeStorageObject(admin, prevPath);

  return jsonBranding(admin);
}

export async function DELETE(req: Request) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await req.json().catch(() => ({}))) as { kind?: string };
  const kind =
    typeof body.kind === "string" && isPlatformBrandingAssetKind(body.kind)
      ? body.kind
      : null;
  if (!kind) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  const current = await fetchPlatformAppBranding(admin);
  const prevPath = prevPathForKind(current, kind);
  const { dbField } = PLATFORM_BRANDING_ASSET_FIELDS[kind];

  const { error: updateError } = await updatePlatformBrandingAssetPath(
    admin,
    dbField,
    null,
  );

  if (updateError) {
    return Response.json({ error: updateError }, { status: 500 });
  }

  await removeStorageObject(admin, prevPath);

  return jsonBranding(admin);
}
