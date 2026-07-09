export type RestaurantReservationDayNoteEntry = {
  id: string;
  restaurant_id: string;
  service_date: string;
  employee_id: string | null;
  actor_user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  actor_label?: string;
};

export const RESERVATION_DAY_NOTE_MAX_LENGTH = 5000;
