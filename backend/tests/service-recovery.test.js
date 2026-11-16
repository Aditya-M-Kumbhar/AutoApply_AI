import test from "node:test";
import assert from "node:assert/strict";
import { retryDelay, startRecovery } from "../src/utils/serviceRecovery.js";

test("Redis continues retrying after long outages without unbounded retry delays", () => {
  for (const attempt of [1, 3, 4, 10, 1000]) {
    assert.equal(typeof retryDelay(attempt), "number");
    assert.ok(retryDelay(attempt) > 0 && retryDelay(attempt) <= 10000);
  }
});
test("recovery can succeed after failure, never overlaps, and stops cleanly", async () => {
  let attempts = 0;
  let errors = 0;
  let release;
  const loop = startRecovery({
    intervalMs: 60000,
    onError: () => errors++,
    recover: async () => {
      attempts++;
      if (attempts === 1) throw new Error("Temporary outage");
      await new Promise((resolve) => {
        release = resolve;
      });
    },
  });
  try {
    await loop.tick();
    assert.equal(errors, 1);
    const pending = loop.tick();
    await loop.tick();
    assert.equal(attempts, 2);
    release();
    await pending;
    loop.stop();
    await loop.tick();
    assert.equal(attempts, 2);
  } finally {
    loop.stop();
  }
});
