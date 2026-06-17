export type PlatformChangelogAudience = "customers" | "superadmin";

export type PlatformChangelogEntry = {
  id: string;
  publishedAt: string;
  title: string;
  body: string;
  version: string | null;
  audience: PlatformChangelogAudience;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlatformChangelogEntryInput = {
  title: string;
  body: string;
  publishedAt: string;
  version?: string | null;
  audience: PlatformChangelogAudience;
};

export const CHANGELOG_AUDIENCE_LABELS: Record<
  PlatformChangelogAudience,
  string
> = {
  customers: "Alle Kunden",
  superadmin: "Nur Superadmin",
};

/** Einträge der letzten N Tage gelten als „Neu“. */
export const CHANGELOG_NEW_DAYS = 7;
