export type RestaurantDocumentNoteEntry = {
  id: string;
  restaurant_id: string;
  document_id: string;
  employee_id: string | null;
  actor_user_id: string | null;
  body: string;
  created_at: string;
  actor_label?: string;
};
