import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import express from "express";
import helmet from "helmet";
import { mountFrontend } from "../src/middlewares/frontend.js";
import { isAllowedOrigin } from "../src/config/origins.js";
import { resolveResumeDirectory } from "../src/config/paths.js";

test("hosted origins allow the configured service without allowing unrelated sites", () => {
  const env = {
    NODE_ENV: "production",
    RENDER_EXTERNAL_URL: "https://auto-apply-ai.onrender.com",
    CLIENT_ORIGIN: "https://careers.example.com/",
  };
  assert.equal(
    isAllowedOrigin("https://auto-apply-ai.onrender.com", env),
    true,
  );
  assert.equal(isAllowedOrigin("https://careers.example.com", env), true);
  assert.equal(isAllowedOrigin("https://unrelated.example", env), false);
  assert.equal(isAllowedOrigin("http://localhost:5173", env), false);
  assert.equal(isAllowedOrigin("http://localhost:5173", {}), true);
  assert.equal(isAllowedOrigin(undefined, env), true);
});
test("resume uploads use the configured persistent directory", () => {
  assert.equal(
    resolveResumeDirectory({ UPLOAD_DIR: "/data/resumes" }),
    path.resolve("/data/resumes"),
  );
  assert.ok(
    resolveResumeDirectory({}).endsWith(
      path.join("backend", "uploads", "resumes"),
    ),
  );
});
test("production serving keeps API errors as JSON and caches only hashed assets long term", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "autoapply-static-"),
  );
  let server;
  try {
    await fs.mkdir(path.join(directory, "assets"));
    await fs.writeFile(
      path.join(directory, "index.html"),
      '<!doctype html><title>Auto Apply AI</title><script src="/theme-init.js"></script>',
    );
    await fs.writeFile(
      path.join(directory, "theme-init.js"),
      'document.documentElement.dataset.theme="dark";',
    );
    await fs.writeFile(
      path.join(directory, "assets", "app-hashed.js"),
      'console.log("app");',
    );
    const app = express();
    app.use(helmet());
    mountFrontend(app, directory);
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    const root = await fetch(base);
    assert.equal(root.status, 200);
    assert.match(await root.text(), /Auto Apply AI/);
    assert.equal(root.headers.get("cache-control"), "no-cache");
    assert.ok(
      root.headers.get("content-security-policy").includes("script-src 'self'"),
    );
    const asset = await fetch(`${base}/assets/app-hashed.js`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("cache-control"), /immutable/);
    const bootstrap = await fetch(`${base}/theme-init.js`);
    assert.equal(bootstrap.headers.get("cache-control"), "no-cache");
    const api = await fetch(`${base}/api/v1/not-a-route`, {
      headers: { Accept: "text/html" },
    });
    assert.equal(api.status, 404);
    assert.match(api.headers.get("content-type"), /application\/json/);
    const missingAsset = await fetch(`${base}/assets/missing.js`);
    assert.equal(missingAsset.status, 404);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    // Only the unique temporary directory created above is removed.
    assert.equal(
      path.dirname(path.resolve(directory)),
      path.resolve(os.tmpdir()),
    );
    assert.ok(path.basename(directory).startsWith("autoapply-static-"));
    await fs.rm(directory, { recursive: true, force: true });
  }
});
