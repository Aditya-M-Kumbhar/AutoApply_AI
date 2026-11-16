import test from "node:test";
import assert from "node:assert/strict";
import { mongoConnection, redisConnection } from "../src/config/connections.js";

test("one canonical connection setting is shared by API and workers", () => {
  assert.equal(
    mongoConnection({ MONGODB_URI: " mongodb://localhost/autoapplyai " }).value,
    "mongodb://localhost/autoapplyai",
  );
  assert.equal(
    redisConnection({
      UPSTASH_REDIS_URL: "rediss://default:secret@example.test:6379",
    }).variable,
    "UPSTASH_REDIS_URL",
  );
});
test("matching legacy settings remain compatible and conflicting settings never override silently", () => {
  const value = "mongodb://localhost/autoapplyai";
  assert.equal(mongoConnection({ MONGO_URI: value }).value, value);
  assert.equal(
    mongoConnection({ MONGODB_URI: value, MONGO_URI: value }).value,
    value,
  );
  assert.throws(
    () =>
      mongoConnection({
        MONGODB_URI: value,
        MONGO_URI: "mongodb://elsewhere/old",
      }),
    /remove MONGO_URI/,
  );
  assert.throws(
    () =>
      redisConnection({
        UPSTASH_REDIS_URL: "rediss://new.test:6379",
        REDIS_URL: "rediss://old.test:6379",
      }),
    /remove REDIS_URL/,
  );
});
test("missing or REST connection settings explain the fix without exposing credentials", () => {
  assert.throws(() => mongoConnection({}), /Set MONGODB_URI/);
  assert.throws(
    () =>
      redisConnection({
        UPSTASH_REDIS_URL: "https://private-secret@example.test",
      }),
    (error) =>
      error.code === "CONNECTION_CONFIG" &&
      error.message.includes("not an HTTPS REST endpoint") &&
      !error.message.includes("private-secret"),
  );
});
