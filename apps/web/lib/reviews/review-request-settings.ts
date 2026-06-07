export type ReviewRequestChannel = "whatsapp" | "email";

export type ReviewRequestIncludes = {
  includeGwada: boolean;
  includeGoogle: boolean;
  includeFacebook: boolean;
};

export type ReviewRequestFormSlice = ReviewRequestIncludes & {
  googleUrl: string;
  facebookUrl: string;
};

export function defaultReviewRequestIncludes(): ReviewRequestIncludes {
  return {
    includeGwada: true,
    includeGoogle: false,
    includeFacebook: false,
  };
}

export function defaultReviewRequestFormSlice(): ReviewRequestFormSlice {
  return {
    ...defaultReviewRequestIncludes(),
    googleUrl: "",
    facebookUrl: "",
  };
}

function legacyIncludesFromRow(
  row: Record<string, unknown> | null | undefined,
): ReviewRequestIncludes {
  const enabled = Boolean(row?.review_request_enabled);
  if (!enabled) {
    return {
      includeGwada: false,
      includeGoogle: false,
      includeFacebook: false,
    };
  }
  return {
    includeGwada: row?.review_request_include_gwada !== false,
    includeGoogle: Boolean(row?.review_request_include_google),
    includeFacebook: Boolean(row?.review_request_include_facebook),
  };
}

export function reviewIncludesFromRow(
  row: Record<string, unknown> | null | undefined,
  channel: ReviewRequestChannel,
): ReviewRequestIncludes {
  const prefix =
    channel === "whatsapp" ? "whatsapp_review_include_" : "email_review_include_";
  if (row?.[`${prefix}gwada`] === undefined) {
    return legacyIncludesFromRow(row);
  }

  return {
    includeGwada: row?.[`${prefix}gwada`] !== false,
    includeGoogle: Boolean(row?.[`${prefix}google`]),
    includeFacebook: Boolean(row?.[`${prefix}facebook`]),
  };
}

export function reviewRequestFormSliceFromRow(
  row: Record<string, unknown> | null | undefined,
  channel: ReviewRequestChannel,
): ReviewRequestFormSlice {
  return {
    ...reviewIncludesFromRow(row, channel),
    googleUrl:
      typeof row?.review_google_url === "string" ? row.review_google_url : "",
    facebookUrl:
      typeof row?.review_facebook_url === "string" ? row.review_facebook_url : "",
  };
}

export function hasAnyReviewInclude(includes: ReviewRequestIncludes): boolean {
  return (
    includes.includeGwada ||
    includes.includeGoogle ||
    includes.includeFacebook
  );
}
