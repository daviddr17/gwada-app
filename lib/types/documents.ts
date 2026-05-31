export type DocumentTagDefinition = {
  id: string;
  name: string;
  active: boolean;
  backgroundColor: string;
};

export type RestaurantDocumentUploader = {
  given_name: string | null;
  family_name: string | null;
};

export type RestaurantDocumentRow = {
  id: string;
  restaurant_id: string;
  tag_id: string | null;
  employee_id: string | null;
  uploaded_by: string | null;
  title: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  tag: {
    id: string;
    name: string;
    background_color: string;
    is_active: boolean;
  } | null;
  uploader: RestaurantDocumentUploader | null;
};

export type RestaurantDocumentsStorageUsage = {
  usedBytes: number;
  quotaBytes: number;
};
