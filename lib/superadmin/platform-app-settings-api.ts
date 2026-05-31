import type {
  PlatformAppBranding,
  PlatformBrandingAssetKind,
} from "@/lib/types/platform-app-settings";

export type PlatformAppSettingsResponse = PlatformAppBranding;

export async function fetchSuperadminPlatformAppSettings(): Promise<PlatformAppSettingsResponse> {
  const res = await fetch("/api/superadmin/platform-app-settings", {
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as PlatformAppSettingsResponse;
}

export async function patchSuperadminPlatformAppName(
  appName: string,
): Promise<PlatformAppSettingsResponse> {
  const res = await fetch("/api/superadmin/platform-app-settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appName }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as PlatformAppSettingsResponse;
}

export async function uploadSuperadminPlatformBrandingAsset(
  kind: PlatformBrandingAssetKind,
  file: File,
): Promise<PlatformAppSettingsResponse> {
  const form = new FormData();
  form.set("kind", kind);
  form.set("file", file);
  const res = await fetch("/api/superadmin/platform-app-settings/upload", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as PlatformAppSettingsResponse;
}

export async function removeSuperadminPlatformBrandingAsset(
  kind: PlatformBrandingAssetKind,
): Promise<PlatformAppSettingsResponse> {
  const res = await fetch("/api/superadmin/platform-app-settings/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as PlatformAppSettingsResponse;
}

export async function fetchPublicPlatformAppBranding(): Promise<PlatformAppBranding> {
  const res = await fetch("/api/platform/app-branding", { cache: "no-store" });
  if (!res.ok) {
    return {
      appName: "gwada",
      logoUrl: null,
      logoDarkUrl: null,
      faviconUrl: null,
      logoPath: null,
      logoDarkPath: null,
      faviconPath: null,
    } satisfies PlatformAppBranding;
  }
  return (await res.json()) as PlatformAppBranding;
}
