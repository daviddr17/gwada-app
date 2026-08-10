import assert from "node:assert/strict";
import test from "node:test";
import type { OrdersService, PaymentsService } from "../orders/orders.service";
import type { SessionsService } from "../sessions/sessions.service";
import type { SupabaseAdminService } from "../supabase-admin.service";
import { SyncService, type SyncEventInput } from "./sync.service";

test("table.merged maps the sync payload to mergeSessions", async () => {
  let received: Parameters<SessionsService["mergeSessions"]>[0] | undefined;
  const sessions = {
    mergeSessions: async (params: Parameters<SessionsService["mergeSessions"]>[0]) => {
      received = params;
      return { ok: true as const, coverCount: 7 };
    },
  } as SessionsService;
  const service = new SyncService(
    {} as SupabaseAdminService,
    sessions,
    {} as OrdersService,
    {} as PaymentsService,
  );
  const applyEvent = (
    service as unknown as {
      applyEvent(
        ctx: { restaurantId: string; profileId: string },
        event: SyncEventInput,
      ): Promise<{ ok: boolean; result?: unknown; error?: string }>;
    }
  ).applyEvent.bind(service);

  const result = await applyEvent(
    { restaurantId: "restaurant", profileId: "profile" },
    {
      idempotencyKey: "merge-1",
      type: "table.merged",
      sessionId: "target-fallback",
      payload: {
        sourceSessionId: "source",
        coverCount: 7,
      },
    },
  );

  assert.deepEqual(received, {
    restaurantId: "restaurant",
    sourceSessionId: "source",
    targetSessionId: "target-fallback",
    coverCount: 7,
  });
  assert.deepEqual(result, {
    ok: true,
    result: { ok: true, coverCount: 7 },
  });
});
