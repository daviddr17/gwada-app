export type RestaurantGuideCategoryRow = {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type RestaurantGuideStepRow = {
  id: string;
  guide_id: string;
  restaurant_id: string;
  position: number;
  body: string;
  image_storage_path: string | null;
  image_mime: string | null;
  image_size_bytes: number | null;
  video_storage_path: string | null;
  video_mime: string | null;
  video_size_bytes: number | null;
  created_at: string;
  updated_at: string;
  /** Signed URL filled client/server when loading for display. */
  image_url?: string | null;
  video_url?: string | null;
};

export type RestaurantGuideRow = {
  id: string;
  restaurant_id: string;
  title: string;
  short_description: string | null;
  is_active: boolean;
  sort_order: number;
  category_id: string | null;
  linked_staff_todo_id: string | null;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  steps?: RestaurantGuideStepRow[];
};

export type GuideStepUpsertInput = {
  id?: string | null;
  body: string;
  position: number;
  image_storage_path?: string | null;
  image_mime?: string | null;
  image_size_bytes?: number | null;
  video_storage_path?: string | null;
  video_mime?: string | null;
  video_size_bytes?: number | null;
  /** Clear existing media on save. */
  clear_image?: boolean;
  clear_video?: boolean;
};

export type GuideUpsertInput = {
  title: string;
  short_description?: string | null;
  is_active?: boolean;
  sort_order?: number;
  category_id?: string | null;
  linked_staff_todo_id?: string | null;
  steps: GuideStepUpsertInput[];
};

export type DisplayGuideStep = {
  id: string;
  position: number;
  body: string;
  image_url: string | null;
  video_url: string | null;
  has_video: boolean;
};

export type DisplayGuide = {
  id: string;
  title: string;
  short_description: string;
  sort_order: number;
  category_id: string | null;
  category_name: string | null;
  steps: DisplayGuideStep[];
};
