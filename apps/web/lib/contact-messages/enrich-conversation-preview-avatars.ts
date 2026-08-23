import { RESTAURANT_CONTACT_AVATARS_BUCKET } from "@/lib/contacts/contact-avatar-storage";
import { isLinkedContactId } from "@/lib/contact-messages/is-linked-contact-id";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";
import type { SupabaseClient } from "@supabase/supabase-js";

const AVATAR_SIGNED_URL_TTL_SEC = 3600;

type PreviewWithAvatarPath = ContactConversationPreview & {
  _avatar_storage_path?: string | null;
};

export async function enrichConversationPreviewAvatars(
  sb: SupabaseClient,
  previews: ContactConversationPreview[],
): Promise<ContactConversationPreview[]> {
  const withPaths = previews as PreviewWithAvatarPath[];
  const paths = new Set<string>();
  for (const row of withPaths) {
    const path = row._avatar_storage_path?.trim();
    if (path) paths.add(path);
  }
  if (paths.size === 0) {
    return previews.map((row) => {
      const { _avatar_storage_path: _, ...rest } = row as PreviewWithAvatarPath;
      return rest;
    });
  }

  const signedByPath = new Map<string, string>();
  await Promise.all(
    [...paths].map(async (path) => {
      const { data, error } = await sb.storage
        .from(RESTAURANT_CONTACT_AVATARS_BUCKET)
        .createSignedUrl(path, AVATAR_SIGNED_URL_TTL_SEC);
      if (!error && data?.signedUrl) {
        signedByPath.set(path, data.signedUrl);
      }
    }),
  );

  return withPaths.map((row) => {
    const { _avatar_storage_path, ...rest } = row;
    const path = _avatar_storage_path?.trim();
    const avatar_url = path ? signedByPath.get(path) ?? null : null;
    return avatar_url ? { ...rest, avatar_url } : rest;
  });
}

/** Nur verknüpfte Kontakte — Pseudo-Threads haben eigene WA-Avatar-Pfade (später). */
export function contactAvatarStoragePathFromRow(
  contactId: string,
  contact: { avatar_storage_path?: string | null } | null | undefined,
): string | null {
  if (!isLinkedContactId(contactId)) return null;
  const path = contact?.avatar_storage_path?.trim();
  return path || null;
}
