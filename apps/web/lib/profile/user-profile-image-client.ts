import type { UserProfileImageKind } from "@/lib/profile/user-profile-image";

export async function uploadUserProfileImageClient(params: {
  kind: UserProfileImageKind;
  file: File;
}): Promise<{ path?: string; kind?: UserProfileImageKind; error?: string }> {
  const form = new FormData();
  form.set("kind", params.kind);
  form.set("file", params.file);

  const res = await fetch("/api/profile/profile-image", {
    method: "POST",
    body: form,
  });

  const body = (await res.json().catch(() => ({}))) as {
    path?: string;
    kind?: UserProfileImageKind;
    error?: string;
  };

  if (!res.ok) return { error: body.error ?? `profile_image_${res.status}` };
  return { path: body.path, kind: body.kind };
}
