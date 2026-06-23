export type StaffContractDocumentVersionRow = {
  id: string;
  version: number;
  is_current: boolean;
  document_id: string;
  created_at: string;
  title: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};
