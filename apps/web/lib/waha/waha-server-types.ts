/** WAHA-Server-Pool (ohne Secret im Client). */

export type WahaServerRow = {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  enabled: boolean;
  accept_new_sessions: boolean;
  session_limit: number;
  warn_remaining: number;
  sort_order: number;
  notes: string | null;
  last_health_ok_at: string | null;
  last_health_error: string | null;
  capacity_warning_active: boolean;
  capacity_warning_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WahaServerPublic = {
  id: string;
  name: string;
  base_url: string;
  api_key_configured: boolean;
  enabled: boolean;
  accept_new_sessions: boolean;
  session_limit: number;
  warn_remaining: number;
  sort_order: number;
  notes: string | null;
  last_health_ok_at: string | null;
  last_health_error: string | null;
  capacity_warning_active: boolean;
  capacity_warning_at: string | null;
  session_count: number;
  warn_threshold: number;
  near_capacity: boolean;
  at_capacity: boolean;
  created_at: string;
  updated_at: string;
};

export type WahaSessionListItem = {
  restaurant_id: string;
  restaurant_name: string | null;
  restaurant_slug: string | null;
  waha_session_name: string;
  status: string;
  phone_number: string | null;
  display_name: string | null;
  last_error: string | null;
  connected_at: string | null;
  updated_at: string;
  waha_server_id: string | null;
  waha_server_name: string | null;
};

export type WahaServerCapacityAlert = {
  server_id: string;
  server_name: string;
  session_count: number;
  session_limit: number;
  warn_remaining: number;
  capacity_warning_at: string | null;
};
