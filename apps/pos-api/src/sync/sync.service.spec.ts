import assert from "node:assert/strict";
import test from "node:test";
import type { CashBagsService } from "../cash-bags/cash-bags.service";
import type { OrdersService, PaymentsService } from "../orders/orders.service";
import type { SessionsService } from "../sessions/sessions.service";
import type { SupabaseAdminService } from "../supabase-admin.service";
import { SyncService, type SyncEventInput } from "./sync.service";

function createApplyEvent(sessions: SessionsService, cashBags?: CashBagsService) {
  const service = new SyncService(
    {} as SupabaseAdminService,
    sessions,
    {} as OrdersService,
    {} as PaymentsService,
    cashBags ?? ({} as unknown as CashBagsService),
  );
  return (
    service as unknown as {
      applyEvent(
        ctx: { restaurantId: string; profileId: string },
        event: SyncEventInput,
      ): Promise<{ ok: boolean; result?: unknown; error?: string }>;
    }
  ).applyEvent.bind(service);
}

test("table.merged maps the sync payload to mergeSessions", async () => {
  let received: Parameters<SessionsService["mergeSessions"]>[0] | undefined;
  const sessions = {
    mergeSessions: async (params: Parameters<SessionsService["mergeSessions"]>[0]) => {
      received = params;
      return { ok: true as const, coverCount: 7 };
    },
  } as SessionsService;
  const applyEvent = createApplyEvent(sessions);

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

test("cash_bag.issued maps payload to CashBagsService.issue", async () => {
  let received: Parameters<CashBagsService["issue"]>[0] | undefined;
  const cashBags = {
    issue: async (params: Parameters<CashBagsService["issue"]>[0]) => {
      received = params;
      return { ok: true as const, bagId: "bag-1" };
    },
  } as unknown as CashBagsService;
  const applyEvent = createApplyEvent({} as SessionsService, cashBags);

  const result = await applyEvent(
    { restaurantId: "restaurant", profileId: "issuer" },
    {
      idempotencyKey: "issue-key-1",
      type: "cash_bag.issued",
      payload: {
        staffProfileId: "waiter-a",
        openingFloatCents: 10_000,
      },
    },
  );

  assert.deepEqual(received, {
    restaurantId: "restaurant",
    staffProfileId: "waiter-a",
    openingFloatCents: 10_000,
    issuedByProfileId: "issuer",
    idempotencyKey: "issue-key-1",
  });
  assert.deepEqual(result, { ok: true, result: { bagId: "bag-1" } });
});

test("cash_bag.handover maps payload to CashBagsService.handover", async () => {
  let received: Parameters<CashBagsService["handover"]>[0] | undefined;
  const cashBags = {
    handover: async (params: Parameters<CashBagsService["handover"]>[0]) => {
      received = params;
      return { ok: true as const, toBagId: "bag-to" };
    },
  } as unknown as CashBagsService;
  const applyEvent = createApplyEvent({} as SessionsService, cashBags);

  const result = await applyEvent(
    { restaurantId: "restaurant", profileId: "from-waiter" },
    {
      idempotencyKey: "handover-1",
      type: "cash_bag.handover",
      payload: { toProfileId: "to-waiter" },
    },
  );

  assert.deepEqual(received, {
    restaurantId: "restaurant",
    fromProfileId: "from-waiter",
    toProfileId: "to-waiter",
  });
  assert.deepEqual(result, { ok: true, result: { toBagId: "bag-to" } });
});

test("cash_bag.closed ignores client managerPinVerified without PIN", async () => {
  let received: Parameters<CashBagsService["close"]>[0] | undefined;
  const cashBags = {
    verifyManagerPinForClose: async () =>
      ({ ok: true as const, verified: false as const }),
    close: async (params: Parameters<CashBagsService["close"]>[0]) => {
      received = params;
      return { ok: true as const, differenceCents: -50 };
    },
  } as unknown as CashBagsService;
  const applyEvent = createApplyEvent({} as SessionsService, cashBags);

  const result = await applyEvent(
    { restaurantId: "restaurant", profileId: "closer" },
    {
      idempotencyKey: "close-1",
      type: "cash_bag.closed",
      payload: {
        bagId: "bag-1",
        closingCountCents: 9_950,
        managerPinVerified: true,
        managerOverrideProfileId: "spoofed-manager",
      },
    },
  );

  assert.deepEqual(received, {
    restaurantId: "restaurant",
    bagId: "bag-1",
    closingCountCents: 9_950,
    closedByProfileId: "closer",
    managerOverrideProfileId: null,
    managerPinVerified: false,
  });
  assert.deepEqual(result, { ok: true, result: { differenceCents: -50 } });
});

test("cash_bag.closed verifies managerPin server-side", async () => {
  let received: Parameters<CashBagsService["close"]>[0] | undefined;
  let pinSeen: string | null | undefined;
  const cashBags = {
    verifyManagerPinForClose: async (
      _restaurantId: string,
      managerPin: string | null | undefined,
    ) => {
      pinSeen = managerPin;
      return {
        ok: true as const,
        verified: true as const,
        profileId: "manager-profile",
      };
    },
    close: async (params: Parameters<CashBagsService["close"]>[0]) => {
      received = params;
      return { ok: true as const, differenceCents: -3_000 };
    },
  } as unknown as CashBagsService;
  const applyEvent = createApplyEvent({} as SessionsService, cashBags);

  const result = await applyEvent(
    { restaurantId: "restaurant", profileId: "closer" },
    {
      idempotencyKey: "close-pin-1",
      type: "cash_bag.closed",
      payload: {
        bagId: "bag-1",
        closingCountCents: 12_000,
        managerPin: "1234",
        managerPinVerified: false,
      },
    },
  );

  assert.equal(pinSeen, "1234");
  assert.deepEqual(received, {
    restaurantId: "restaurant",
    bagId: "bag-1",
    closingCountCents: 12_000,
    closedByProfileId: "closer",
    managerOverrideProfileId: "manager-profile",
    managerPinVerified: true,
  });
  assert.deepEqual(result, { ok: true, result: { differenceCents: -3_000 } });
});
