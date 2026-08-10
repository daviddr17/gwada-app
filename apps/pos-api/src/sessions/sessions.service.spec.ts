import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseAdminService } from "../supabase-admin.service";
import { SessionsService, type RegisterGateService } from "./sessions.service";

type QueryResponse = {
  data?: Record<string, unknown> | null;
  error?: { message: string } | null;
};

type QueryRecord = {
  table: string;
  action: "select" | "update";
  values?: Record<string, unknown>;
  filters: Array<[string, unknown]>;
};

class FakeQuery implements PromiseLike<QueryResponse> {
  private readonly record: QueryRecord;

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

  eq(column: string, value: unknown): this {
    this.record.filters.push([column, value]);
    return this;
  }

  in(column: string, value: unknown): this {
    this.record.filters.push([column, value]);
    return this;
  }

  limit(): this {
    return this;
  }

  maybeSingle(): Promise<QueryResponse> {
    return Promise.resolve(this.responses.shift() ?? {});
  }

  then<TResult1 = QueryResponse, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.responses.shift() ?? {}).then(onfulfilled, onrejected);
  }
}

function createService(responses: QueryResponse[]) {
  const records: QueryRecord[] = [];
  const client = {
    from: (table: string) => new FakeQuery(table, responses, records),
  } as unknown as SupabaseClient;
  const supabaseAdmin = {
    getClient: () => client,
  } as SupabaseAdminService;

  return {
    records,
    service: new SessionsService(supabaseAdmin, {} as RegisterGateService),
  };
}

test("mergeSessions moves orders, combines covers, and closes the source", async () => {
  const { service, records } = createService([
    {
      data: {
        id: "source",
        restaurant_id: "restaurant",
        status: "open",
        cover_count: 2,
      },
    },
    {
      data: {
        id: "target",
        restaurant_id: "restaurant",
        status: "bill",
        cover_count: 3,
      },
    },
    { error: null },
    { error: null },
    { error: null },
  ]);

  const result = await service.mergeSessions({
    restaurantId: "restaurant",
    sourceSessionId: "source",
    targetSessionId: "target",
  });

  assert.deepEqual(result, { ok: true, coverCount: 5 });
  assert.deepEqual(records[2], {
    table: "pos_orders",
    action: "update",
    values: { table_session_id: "target" },
    filters: [
      ["table_session_id", "source"],
      ["restaurant_id", "restaurant"],
    ],
  });
  assert.deepEqual(records[3]?.values, { cover_count: 5 });
  assert.equal(records[4]?.values?.status, "closed");
  assert.match(String(records[4]?.values?.closed_at), /^\d{4}-\d{2}-\d{2}T/);
});

test("mergeSessions accepts an already-closed source after its orders moved", async () => {
  const { service, records } = createService([
    {
      data: {
        id: "source",
        restaurant_id: "restaurant",
        status: "closed",
        cover_count: 2,
      },
    },
    {
      data: {
        id: "target",
        restaurant_id: "restaurant",
        status: "open",
        cover_count: 5,
      },
    },
    { data: null },
  ]);

  const result = await service.mergeSessions({
    restaurantId: "restaurant",
    sourceSessionId: "source",
    targetSessionId: "target",
  });

  assert.deepEqual(result, { ok: true, coverCount: 5 });
  assert.equal(records.length, 3);
});
