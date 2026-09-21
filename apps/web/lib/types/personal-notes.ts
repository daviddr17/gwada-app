export type RestaurantPersonalNoteRow = {
  id: string;
  restaurant_id: string;
  profile_id: string;
  title: string;
  body: string | null;
  remind_at: string | null;
  reminded_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RestaurantPersonalNoteUpsertInput = {
  id?: string;
  title: string;
  body?: string | null;
  remind_at?: string | null;
  completed_at?: string | null;
};
