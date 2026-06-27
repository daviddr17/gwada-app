import type {
  ComplianceCategory,
  ComplianceChecklistItem,
  ComplianceFrequency,
} from "@/lib/types/compliance";

export type PlatformComplianceChecklistTemplate = {
  id: string;
  countryCode: string;
  name: string;
  description: string | null;
  category: ComplianceCategory;
  frequency: ComplianceFrequency;
  items: ComplianceChecklistItem[];
  showOnDisplay: boolean;
  version: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlatformComplianceChecklistTemplateInput = {
  countryCode: string;
  name: string;
  description?: string | null;
  category: ComplianceCategory;
  frequency: ComplianceFrequency;
  items: ComplianceChecklistItem[];
  showOnDisplay?: boolean;
  version?: number;
  sortOrder?: number;
  isActive?: boolean;
};
