export const PLATFORM_EMPLOYMENT_LEGACY_KEYS = [
  "full_time",
  "part_time",
  "mini_job",
  "fixed_term",
  "internship",
  "student",
  "other",
] as const;

export type PlatformEmploymentLegacyKey =
  (typeof PLATFORM_EMPLOYMENT_LEGACY_KEYS)[number];

export const PLATFORM_EMPLOYMENT_LEGACY_LABELS: Record<
  PlatformEmploymentLegacyKey,
  string
> = {
  full_time: "Vollzeit",
  part_time: "Teilzeit",
  mini_job: "Minijob",
  fixed_term: "Befristet",
  internship: "Praktikum",
  student: "Werkstudent",
  other: "Sonstiges",
};

export type PlatformStaffContractTemplateParagraph = {
  id: string;
  templateId: string;
  sortOrder: number;
  heading: string | null;
  body: string;
};

export type PlatformStaffContractTemplate = {
  id: string;
  countryCode: string;
  employmentLegacyKey: PlatformEmploymentLegacyKey;
  name: string;
  title: string;
  legalNotice: string | null;
  version: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  paragraphs?: PlatformStaffContractTemplateParagraph[];
};

export type PlatformStaffContractTemplateInput = {
  countryCode: string;
  employmentLegacyKey: PlatformEmploymentLegacyKey;
  name: string;
  title: string;
  legalNotice?: string | null;
  version?: number;
  sortOrder?: number;
  isActive?: boolean;
  paragraphs: Array<{ heading: string; body: string }>;
};

export type PlatformStaffContractCatalogItem = {
  id: string;
  countryCode: string;
  employmentLegacyKey: PlatformEmploymentLegacyKey;
  name: string;
  title: string;
  legalNotice: string | null;
  version: number;
  alreadyImported: boolean;
  importedRestaurantTemplateId: string | null;
  updateAvailable: boolean;
};
