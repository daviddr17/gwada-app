import assert from "node:assert/strict";
import test from "node:test";
import type { CashBagsService } from "../cash-bags/cash-bags.service";
import type { SupabaseAdminService } from "../supabase-admin.service";
import { ShiftsService } from "./shifts.service";

type QueryResponse = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
};

type QueryRecord = {
  table: string;
  action: "select" | "update" | "insert" | "delete" | "rpc";
  values?: Record<string, unknown>;
  filters: Array<[string, unknown]>;
};

class FakeQuery implements PromiseLike<QueryResponse> {
  private readonly record: QueryRecord;
  private terminal: "maybeSingle" | "single" | "await" | null = null;

  constructor(
    table: string,
    private readonly responses: QueryResponse[],
    records: QueryRecord[],
  ) {
    this.record = { table, action: "select", filters: [] };
    records.push(this.record);
  }

  select(): this {
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.record.action = "update";
    this.record.values = values;
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]): this {
    this.record.action = "insert";
    this.record.values = Array.isArray(values) ? values[0] : values;
    return this;
  }

  delete(): this {
    this.record.action = "delete";
    return this;
  }

  eq(column: string, value: unknown): this {
    this.record.filters.push([column, value]);
    return this;
  }

  in(column: string, value: unknown): this {
    this.record.filters.push([column, value]);
    return this;
  }

  is(column: string, value: unknown): this {
    this.record.filters.push([column, value]);
    return this;
  }

  order(): this {
    return this;
  }

  limit(): this {
    return this;
  }

  maybeSingle(): Promise<QueryResponse> {
    this.terminal = "maybeSingle";
    return Promise.resolve(this.responses.shift() ?? {});
  }

  single(): Promise<QueryResponse> {
    this.terminal = "single";
    return Promise.resolve(this.responses.shift() ?? {});
  }

  then<TResult1 = QueryResponse, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    this.terminal = this.terminal ?? "await";
    return Promise.resolve(this.responses.shift() ?? {}).then(
      onfulfilled,
      onrejected,
    );
  }
}

function createShiftsService(opts: {
  responses: QueryResponse[];
  cashBags: CashBagsService;
  rpcOk?: boolean;
}) {
  const records: QueryRecord[] = [];
  const client = {
    from: (table: string) => new FakeQuery(table, opts.responses, records),
    rpc: async () => {
      records.push({ table: "rpc", action: "rpc", filters: [] });
      if (opts.rpcOk === false) {
        return { data: null, error: { message: "missing" } };
      }
      return {
        data: { profile_id: "to-profile" },
        error: null,
      };
    },
  };
  const supabaseAdmin = {
    getClient: () => client,
  } as unknown as SupabaseAdminService;

  return {
    records,
    service: new ShiftsService(supabaseAdmin, opts.cashBags),
  };
}

test("transferSessions with transferCashBag calls handover after owner update", async () => {
  let handoverParams: Parameters<CashBagsService["handover"]>[0] | undefined;
  const cashBags = {
    handover: async (params: Parameters<CashBagsService["handover"]>[0]) => {
      handoverParams = params;
      return { ok: true as const, toBagId: "bag-to-1" };
    },
  } as unknown as CashBagsService;

  const { records, service } = createShiftsService({
    responses: [
      {
        data: [
          {
            id: "sess-1",
            owner_profile_id: "from-profile",
            status: "open",
          },
        ],
      },
      { data: null, error: null }, // owner update
    ],
    cashBags,
  });

  const result = await service.transferSessions({
    restaurantId: "rest-1",
    fromProfileId: "from-profile",
    toProfileId: "to-profile",
    sessionIds: ["sess-1"],
    toPin: "1234",
    transferCashBag: true,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.transferredSessionIds, ["sess-1"]);
    assert.equal(result.toBagId, "bag-to-1");
  }
  assert.deepEqual(handoverParams, {
    restaurantId: "rest-1",
    fromProfileId: "from-profile",
    toProfileId: "to-profile",
  });

  const ownerUpdate = records.find(
    (r) => r.table === "pos_table_sessions" && r.action === "update",
  );
  assert.deepEqual(ownerUpdate?.values, { owner_profile_id: "to-profile" });
});

test("transferSessions rolls back owners when handover fails", async () => {
  const cashBags = {
    handover: async () =>
      ({ ok: false as const, error: "from_bag_not_open", status: 404 }),
    resolveHandoverReplay: async () => null,
  } as unknown as CashBagsService;

  const { records, service } = createShiftsService({
    responses: [
      {
        data: [
          {
            id: "sess-1",
            owner_profile_id: "from-profile",
            status: "open",
          },
        ],
      },
      { data: null, error: null }, // owner update → to
      { data: null, error: null }, // rollback update → from
    ],
    cashBags,
  });

  const result = await service.transferSessions({
    restaurantId: "rest-1",
    fromProfileId: "from-profile",
    toProfileId: "to-profile",
    sessionIds: ["sess-1"],
    toPin: "1234",
    transferCashBag: true,
  });

  assert.deepEqual(result, {
    ok: false,
    error: "from_bag_not_open",
    status: 404,
  });

  const updates = records.filter(
    (r) => r.table === "pos_table_sessions" && r.action === "update",
  );
  assert.equal(updates.length, 2);
  assert.deepEqual(updates[0]?.values, { owner_profile_id: "to-profile" });
  assert.deepEqual(updates[1]?.values, { owner_profile_id: "from-profile" });
});

test("transferSessions succeeds without rollback when handover already done", async () => {
  const cashBags = {
    handover: async () =>
      ({ ok: false as const, error: "from_bag_not_open", status: 404 }),
    resolveHandoverReplay: async () => ({ toBagId: "bag-to-existing" }),
  } as unknown as CashBagsService;

  const { records, service } = createShiftsService({
    responses: [
      {
        data: [
          {
            id: "sess-1",
            owner_profile_id: "from-profile",
            status: "open",
          },
        ],
      },
      { data: null, error: null }, // owner update → to
    ],
    cashBags,
  });

  const result = await service.transferSessions({
    restaurantId: "rest-1",
    fromProfileId: "from-profile",
    toProfileId: "to-profile",
    sessionIds: ["sess-1"],
    toPin: "1234",
    transferCashBag: true,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.transferredSessionIds, ["sess-1"]);
    assert.equal(result.toBagId, "bag-to-existing");
  }

  const updates = records.filter(
    (r) => r.table === "pos_table_sessions" && r.action === "update",
  );
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0]?.values, { owner_profile_id: "to-profile" });
});

test("transferSessions without transferCashBag skips handover", async () => {
  let handoverCalled = false;
  const cashBags = {
    handover: async () => {
      handoverCalled = true;
      return { ok: true as const, toBagId: "x" };
    },
  } as unknown as CashBagsService;

  const { service } = createShiftsService({
    responses: [
      {
        data: [
          {
            id: "sess-1",
            owner_profile_id: "from-profile",
            status: "open",
          },
        ],
      },
      { data: null, error: null },
    ],
    cashBags,
  });

  const result = await service.transferSessions({
    restaurantId: "rest-1",
    fromProfileId: "from-profile",
    toProfileId: "to-profile",
    sessionIds: ["sess-1"],
    toPin: "1234",
    transferCashBag: false,
  });

  assert.equal(result.ok, true);
  assert.equal(handoverCalled, false);
  if (result.ok) {
    assert.equal("toBagId" in result, false);
  }
});
