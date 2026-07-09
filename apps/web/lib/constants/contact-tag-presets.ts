/** System-Tag-Slug für VIP-Gäste. */
export const CONTACT_TAG_VIP_SLUG = "vip";

export const CONTACT_TAG_VIP_COLOR = "#eab308";

export const CONTACT_TAG_FILTER_ALL = "all" as const;
export const CONTACT_TAG_FILTER_UNTAGGED = "__untagged__" as const;

export type ContactTagFilterValue =
  | typeof CONTACT_TAG_FILTER_ALL
  | typeof CONTACT_TAG_FILTER_UNTAGGED
  | string;
