import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { getOpsRealtimeHealth } from "@/lib/ops/ops-realtime-health";
import { subscribeRestaurantTableChanges } from "@/lib/supabase/restaurant-table-realtime";

test("proxy channels count for ops status without a websocket", () => {
  const g = globalThis as typeof globalThis & {
    window?: {
      __GWADA_PUBLIC_ENV__?: { supabaseProxy?: boolean };
    };
    document?: {
      visibilityState: DocumentVisibilityState;
      addEventListener: () => void;
      removeEventListener: () => void;
    };
  };
  const prevWindow = g.window;
  const prevDocument = g.document;

  g.window = { __GWADA_PUBLIC_ENV__: { supabaseProxy: true } };
  g.document = {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
  };

  mock.timers.enable({ apis: ["setTimeout"] });

  let channelCalls = 0;
  let statusCalls = 0;
  const sb = {
    channel() {
      channelCalls += 1;
      throw new Error("websocket");
    },
    getChannels() {
      return [];
    },
    removeChannel() {},
  };

  let stop = () => {};
  try {
    stop = subscribeRestaurantTableChanges(sb as never, {
      channelName: "ops-proxy-count-test",
      table: "reservations",
      restaurantId: "00000000-0000-4000-8000-000000000001",
      onChange: () => {},
      onStatus: () => {
        statusCalls += 1;
      },
    });

    const starting = getOpsRealtimeHealth();
    assert.equal(starting.channelCount, 1);
    assert.equal(starting.connectedCount, 0);
    assert.equal(starting.live, false);
    assert.equal(channelCalls, 0);

    mock.timers.tick(2_500);

    const live = getOpsRealtimeHealth();
    assert.equal(live.channelCount, 1);
    assert.equal(live.connectedCount, 1);
    assert.equal(live.live, true);
    assert.equal(channelCalls, 0);
    assert.equal(statusCalls, 0);
  } finally {
    stop();
    mock.timers.reset();
    g.window = prevWindow;
    g.document = prevDocument;
  }

  const cleared = getOpsRealtimeHealth();
  assert.equal(cleared.channelCount, 0);
  assert.equal(cleared.connectedCount, 0);
});
