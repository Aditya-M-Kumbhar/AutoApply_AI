import fs from "node:fs";
import path from "node:path";
import dns from "node:dns/promises";
import net from "node:net";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Redis from "ioredis";
import { mongoConnection, redisConnection } from "../src/config/connections.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {
  ...dotenv.parse(
    fs.existsSync(path.join(root, ".env"))
      ? fs.readFileSync(path.join(root, ".env"))
      : "",
  ),
  ...process.env,
};
const results = [];
const timeout = (promise, ms = 6000) => {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () =>
          reject(Object.assign(new Error("Timed out"), { code: "TIMEOUT" })),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
};
const tcp = (host, port) =>
  new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(5000);
    socket.once("connect", () => {
      socket.destroy();
      resolve();
    });
    socket.once("timeout", () =>
      socket.destroy(
        Object.assign(new Error("TCP timeout"), { code: "TIMEOUT" }),
      ),
    );
    socket.once("error", reject);
  });
for (const [service, primary, fallback, protocols, defaultPort] of [
  ["MongoDB", "MONGODB_URI", "MONGO_URI", ["mongodb:", "mongodb+srv:"], 27017],
  ["Redis", "UPSTASH_REDIS_URL", "REDIS_URL", ["redis:", "rediss:"], 6379],
]) {
  const value = env[primary] || env[fallback];
  const row = {
    service,
    configured: Boolean(value),
    effectiveVariable: env[primary] ? primary : fallback,
  };
  try {
    const connection =
      service === "MongoDB" ? mongoConnection(env) : redisConnection(env);
    row.effectiveVariable = connection.variable;
    const url = new URL(connection.value);
    if (!protocols.includes(url.protocol))
      throw Object.assign(new Error("Invalid protocol"), {
        code: "INVALID_PROTOCOL",
      });
    if (url.protocol === "mongodb+srv:") {
      const records = await timeout(
        dns.resolveSrv(`_mongodb._tcp.${url.hostname}`),
      );
      row.dns = "ok";
      await tcp(records[0].name, records[0].port);
      row.tcp = "ok";
    } else {
      await timeout(dns.lookup(url.hostname));
      row.dns = "ok";
      await tcp(url.hostname, Number(url.port) || defaultPort);
      row.tcp = "ok";
    }
    if (process.argv.includes("--auth")) {
      if (service === "MongoDB") {
        const client = mongoose.createConnection(connection.value, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 5000,
        });
        try {
          await client.asPromise();
          await client.db.command({ ping: 1 });
          row.authentication = "ok";
        } finally {
          await client.close();
        }
      } else {
        const client = new Redis(connection.value, {
          lazyConnect: true,
          connectTimeout: 5000,
          maxRetriesPerRequest: 0,
          enableOfflineQueue: false,
          retryStrategy: null,
        });
        client.on("error", () => {});
        try {
          await timeout(client.connect());
          await timeout(client.ping());
          row.authentication = "ok";
        } finally {
          client.disconnect();
        }
      }
      row.note =
        "DNS, TCP, and authenticated ping passed. Application-specific permissions are not tested.";
    } else
      row.note =
        "DNS and TCP passed. Add --auth to check authenticated connections.";
  } catch (error) {
    row.error = error.code || error.name;
    row.note =
      error.code === "CONNECTION_CONFIG"
        ? error.message
        : row.tcp === "ok"
          ? "Authenticated connection failed. Check credentials, TLS, access rules, and provider settings."
          : "Connection failed before authentication. Check the endpoint, provider database status, and network/DNS.";
  }
  results.push(row);
}
results.push({
  service: "JWT",
  accessSecretConfigured: Boolean(env.JWT_ACCESS_SECRET),
  refreshSecretConfigured: Boolean(env.JWT_REFRESH_SECRET),
  secretsDistinct: Boolean(
    env.JWT_ACCESS_SECRET &&
    env.JWT_REFRESH_SECRET &&
    env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET,
  ),
});
for (const [provider, variable, endpoint, model] of [
  [
    "Gemini",
    "GEMINI_API_KEY",
    "https://generativelanguage.googleapis.com/v1beta/models",
    env.GEMINI_MODEL || "gemini-3.8-flash",
  ],
  [
    "Groq",
    "GROQ_API_KEY",
    "https://api.groq.com/openai/v1/models",
    env.GROQ_MODEL || "openai/gpt-oss-20b",
  ],
]) {
  const key = env[variable]?.split(",")[0]?.trim();
  const row = { service: provider, configured: Boolean(key) };
  if (key && process.argv.includes("--ai"))
    try {
      // Model-list requests validate access without sending user content or generating tokens.
      const response = await fetch(endpoint, {
        headers:
          provider === "Gemini"
            ? { "x-goog-api-key": key }
            : { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
      });
      row.httpStatus = response.status;
      if (response.ok) {
        const data = await response.json();
        row.configuredModelListed = (data.models || data.data || []).some(
          (item) => item.name === `models/${model}` || item.id === model,
        );
        row.note =
          "Model listing accepted. Generation quota and billing are not tested.";
      } else
        row.note =
          "Provider rejected model listing. Check key permissions, restrictions, or account status.";
    } catch (error) {
      row.error = error.cause?.code || error.name;
    }
  results.push(row);
}
console.log(
  JSON.stringify({ checks: results, secretsPrinted: false }, null, 2),
);
if (
  results.some(
    (row) =>
      row.error ||
      row.configured === false ||
      row.httpStatus >= 400 ||
      row.configuredModelListed === false ||
      row.accessSecretConfigured === false ||
      row.refreshSecretConfigured === false ||
      row.secretsDistinct === false,
  )
)
  process.exitCode = 1;
