import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { jobs } from "../evals/fixtures.js";

test(
  "search and RAG API use a real isolated MongoDB catalog without Redis or LLM keys",
  { skip: process.env.RUN_DB_TESTS !== "1", timeout: 30000 },
  async () => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1");
    await once(probe, "listening");
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    const database = `talentradar_test_${randomBytes(6).toString("hex")}`;
    const uri = `mongodb://127.0.0.1:27017/${database}`;
    const connection = await mongoose
      .createConnection(uri, { serverSelectionTimeoutMS: 3000 })
      .asPromise();
    const secret = randomBytes(32).toString("hex");
    let child;
    try {
      const userId = new mongoose.Types.ObjectId();
      await connection
        .collection("users")
        .insertOne({
          _id: userId,
          name: "API Test",
          email: "test@example.test",
          skills: ["React", "TypeScript"],
          role: "candidate",
        });
      await connection
        .collection("jobs")
        .insertMany(
          jobs.map(({ _id, ...job }) => ({
            ...job,
            _id: new mongoose.Types.ObjectId(),
            postedAt: new Date(job.postedAt),
          })),
        );
      const root = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
      );
      child = spawn(process.execPath, ["src/server.js"], {
        cwd: root,
        windowsHide: true,
        stdio: "ignore",
        env: {
          ...process.env,
          PORT: String(port),
          MONGODB_URI: uri,
          MONGO_URI: uri,
          UPSTASH_REDIS_URL: "redis://127.0.0.1:1",
          REDIS_URL: "redis://127.0.0.1:1",
          ENABLE_WORKERS: "false",
          JWT_ACCESS_SECRET: secret,
          JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
          GEMINI_API_KEY: "",
          GROQ_API_KEY: "",
          HF_API_KEY: "",
        },
      });
      const base = `http://127.0.0.1:${port}`;
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        try {
          const response = await fetch(`${base}/health`, {
            signal: AbortSignal.timeout(1000),
          });
          const data = await response.json();
          if (data.services.database === "connected") {
            ready = true;
            break;
          }
        } catch {
          /* Server is starting. */
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      assert.equal(ready, true);
      const token = jwt.sign(
        { id: String(userId), email: "test@example.test", role: "candidate" },
        secret,
        { expiresIn: "1h" },
      );
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
      const query = await fetch(`${base}/api/v1/jobs?search=React&limit=2`, {
        headers,
      });
      assert.equal(query.status, 200);
      const result = await query.json();
      assert.equal(result.data.jobs[0].title, "Frontend Engineer");
      assert.equal(result.data.jobs[0].fitScore, 67);
      assert.deepEqual(result.data.jobs[0].matchExplanation.missingSkills, [
        "accessibility",
      ]);
      const filtered = await (
        await fetch(`${base}/api/v1/jobs?location=London`, { headers })
      ).json();
      assert.equal(filtered.data.jobs.length, 1);
      assert.equal(filtered.data.jobs[0].title, "Java Backend Engineer");
      const invalid = await fetch(`${base}/api/v1/jobs?page=-1`, { headers });
      assert.equal(invalid.status, 400);
      const literal = await fetch(
        `${base}/api/v1/jobs?search=${encodeURIComponent("[")}`,
        { headers },
      );
      assert.equal(literal.status, 200);
      const response = await fetch(`${base}/api/v1/assistant/ask`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          question: "React frontend roles",
          useAI: false,
        }),
      });
      assert.equal(response.status, 200);
      const answer = (await response.json()).data;
      assert.equal(answer.mode, "retrieval");
      assert.equal(answer.sources[0].title, "Frontend Engineer");
      const unknown = await fetch(`${base}/api/v1/assistant/ask`, {
        method: "POST",
        headers,
        body: JSON.stringify({ question: "quantum aerospace", useAI: false }),
      });
      assert.equal((await unknown.json()).data.abstained, true);
      const unauthorized = await fetch(`${base}/api/v1/assistant/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "React roles" }),
      });
      assert.equal(unauthorized.status, 401);
      const login = await fetch(`${base}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      assert.equal(login.status, 503);
      assert.equal((await fetch(`${base}/health/live`)).status, 200);
    } finally {
      if (child) {
        child.kill();
        await Promise.race([
          once(child, "exit"),
          new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
      }
      assert.match(database, /^talentradar_test_[a-f0-9]{12}$/);
      await connection.dropDatabase();
      await connection.close();
    }
  },
);
