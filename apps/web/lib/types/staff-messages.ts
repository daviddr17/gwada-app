export type RestaurantStaffConversationRow = {
  id: string;
  restaurant_id: string;
  participant_a: string;
  participant_b: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_sender_profile_id: string | null;
  created_at: string;
  updated_at: string;
  /** Gegenüber (nicht der aktuelle User). */
  peer_profile_id: string;
  peer_name: string;
  is_unread: boolean;
};

export type RestaurantStaffMessageRow = {
  id: string;
  restaurant_id: string;
  conversation_id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
};
