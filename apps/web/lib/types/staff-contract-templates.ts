export type StaffContractTemplateParagraphRow = {
  id: string;
  template_id: string;
  sort_order: number;
  heading: string | null;
  body: string;
};

export type StaffContractTemplateRow = {
  id: string;
  restaurant_id: string;
  employment_type_id: string;
  name: string;
  title: string;
  sort_order: number;
  is_active: boolean;
  paragraphs?: StaffContractTemplateParagraphRow[];
};

export type StaffContractSignatureSnapshot = {
  signer_name: string;
  signed_at: string;
  signature_storage_path?: string | null;
};

export type StaffContractBodySnapshot = {
  template_id: string | null;
  template_name: string | null;
  title: string;
  paragraphs: Array<{
    heading: string | null;
    body: string;
  }>;
  placeholders?: Record<string, string>;
};
