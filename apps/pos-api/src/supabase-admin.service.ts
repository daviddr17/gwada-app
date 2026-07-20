import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseAdminService {
  private client: SupabaseClient | null = null;

  getClient(): SupabaseClient {
    if (this.client) return this.client;
    const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) {
      throw new ServiceUnavailableException(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for catalog/branding",
      );
    }
    this.client = createClient(url.replace(/\/$/, ""), key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return this.client;
  }
}
