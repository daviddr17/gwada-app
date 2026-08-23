/** Facebook Graph post shape (News feed). */
export type FbPostAttachment = {
  type?: string;
  title?: string;
  description?: string;
  url?: string;
  unshimmed_url?: string;
  media_type?: string;
  media?: { image?: { src?: string }; source?: string };
  target?: { id?: string; url?: string };
  subattachments?: { data?: FbPostAttachment[] };
};

export type FbPostForNews = {
  id?: string;
  message?: string;
  story?: string;
  created_time?: string;
  permalink_url?: string;
  picture?: string;
  full_picture?: string;
  attachments?: { data?: FbPostAttachment[] };
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
};

const SHARED_POST_LABEL = "Geteilter Beitrag";

function flattenAttachments(
  attachments: FbPostAttachment[] | undefined,
  out: FbPostAttachment[] = [],
): FbPostAttachment[] {
  if (!attachments?.length) return out;
  for (const att of attachments) {
    out.push(att);
    if (att.subattachments?.data?.length) {
      flattenAttachments(att.subattachments.data, out);
    }
  }
  return out;
}

function attachmentImageSrc(att: FbPostAttachment): string | null {
  return att.media?.image?.src?.trim() || null;
}

function pickPostImage(post: FbPostForNews, flat: FbPostAttachment[]): {
  url: string | null;
  thumbUrl: string | null;
} {
  const fromPost =
    post.full_picture?.trim() ||
    post.picture?.trim() ||
    null;
  let fromAtt: string | null = null;
  for (const att of flat) {
    const src = attachmentImageSrc(att);
    if (src) {
      fromAtt = src;
      break;
    }
  }
  const url = fromPost || fromAtt;
  const thumb = post.picture?.trim() || null;
  return {
    url,
    thumbUrl: thumb && thumb !== url ? thumb : null,
  };
}

function isShareAttachment(att: FbPostAttachment): boolean {
  const type = att.type?.toLowerCase() ?? "";
  return (
    type === "share" ||
    type === "link" ||
    type.includes("share") ||
    type === "animated_image_share"
  );
}

function pickExternalUrl(
  post: FbPostForNews,
  flat: FbPostAttachment[],
): string | null {
  if (post.permalink_url?.trim()) return post.permalink_url.trim();
  for (const att of flat) {
    const target = att.target?.url?.trim();
    if (target) return target;
    const url = att.unshimmed_url?.trim() || att.url?.trim();
    if (url) return url;
  }
  return null;
}

/**
 * Text + Medien aus FB-Post — inkl. geteilte Beiträge ohne eigenes `message`.
 */
export function parseFacebookPostForNews(post: FbPostForNews): {
  title: string | null;
  body: string;
  mediaUrl: string | null;
  thumbUrl: string | null;
  externalUrl: string | null;
  isSharedPost: boolean;
} {
  const flat = flattenAttachments(post.attachments?.data);
  const { url: mediaUrl, thumbUrl } = pickPostImage(post, flat);
  const externalUrl = pickExternalUrl(post, flat);

  let body =
    post.message?.trim() ||
    post.story?.trim() ||
    "";
  let title: string | null = null;
  let isSharedPost = false;

  const shareAtt = flat.find(isShareAttachment);
  const richAtt =
    flat.find((a) => a.title?.trim() || a.description?.trim()) ?? shareAtt;

  if (shareAtt && !post.message?.trim()) {
    isSharedPost = true;
  }

  if (richAtt) {
    const attTitle = richAtt.title?.trim() ?? "";
    const attDesc = richAtt.description?.trim() ?? "";
    if (!body && attDesc) body = attDesc;
    if (!body && attTitle) body = attTitle;
    if (attTitle && attDesc && attTitle !== attDesc) {
      title = attTitle;
      if (!post.message?.trim()) body = attDesc;
    } else if (attTitle && !body) {
      body = attTitle;
    }
  }

  if (isSharedPost && !post.message?.trim()) {
    title = title ?? SHARED_POST_LABEL;
    if (!body) {
      body = "Auf Facebook geteilt — Details im Originalbeitrag.";
    }
  }

  if (!body && !title && mediaUrl) {
    title = SHARED_POST_LABEL;
    body = "Auf Facebook geteilt — Vorschau ohne Text.";
  }

  return { title, body, mediaUrl, thumbUrl, externalUrl, isSharedPost };
}
