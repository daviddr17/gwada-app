import "server-only";

import {
  isLexofficeRateLimited,
  LEXOFFICE_DETAIL_FETCH_DELAY_MS,
  LEXOFFICE_MAX_DETAIL_FETCHES_PER_SYNC,
  markLexofficeRateLimited,
} from "@/lib/integrations/lexoffice-api-cache";
import { isLexofficeRateLimitError } from "@/lib/accounting/lexoffice-rate-limit";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Begrenzt Detail-Abrufe pro Sync-Lauf und entlastet Lexware-Burst-Limits. */
export class LexofficeDetailFetchBudget {
  private remaining: number;
  private lastFetchAt = 0;
  rateLimitedDuringSync = false;

  constructor(max = LEXOFFICE_MAX_DETAIL_FETCHES_PER_SYNC) {
    this.remaining = max;
  }

  canFetchDetail(restaurantId: string): boolean {
    if (isLexofficeRateLimited(restaurantId) || this.rateLimitedDuringSync) {
      return false;
    }
    return this.remaining > 0;
  }

  async beforeDetailFetch(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastFetchAt;
    if (elapsed < LEXOFFICE_DETAIL_FETCH_DELAY_MS) {
      await sleep(LEXOFFICE_DETAIL_FETCH_DELAY_MS - elapsed);
    }
    this.lastFetchAt = Date.now();
  }

  consume(): void {
    this.remaining = Math.max(0, this.remaining - 1);
  }

  noteFetchError(restaurantId: string, error: string): void {
    if (!isLexofficeRateLimitError(error)) return;
    markLexofficeRateLimited(restaurantId);
    this.rateLimitedDuringSync = true;
  }
}
