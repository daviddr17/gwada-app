import assert from "node:assert/strict";
import { test } from "node:test";

import {
  restaurantCronBucket,
  shouldSyncRestaurantInCronSlot,
} from "./cron-restaurant-stagger.ts";

test("stable bucket per restaurant", () => {
  const id = "fcc50bb3-130d-476b-94dc-3c7392b773a8";
  assert.equal(restaurantCronBucket(id, 10), restaurantCronBucket(id, 10));
  assert.ok(restaurantCronBucket(id, 10) >= 0);
  assert.ok(restaurantCronBucket(id, 10) < 10);
});

test("slot filter includes only the current bucket", () => {
  const id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const bucket = restaurantCronBucket(id, 5);
  assert.equal(shouldSyncRestaurantInCronSlot(id, 5, bucket), true);
  assert.equal(shouldSyncRestaurantInCronSlot(id, 5, (bucket + 1) % 5), false);
});
