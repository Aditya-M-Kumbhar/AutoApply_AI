import test from "node:test";
import assert from "node:assert/strict";
import { extractLocalSkills, extractResumeSkills } from "../src/services/resumeSkills.js";

test("resume upload extracts technical skills without any provider request", async () => {
  const result = await extractResumeSkills("React, Node.js, MongoDB, Redis, Playwright, BullMQ, BM25, RAG", {generate: () => { throw new Error("must not call provider"); }});
  assert.equal(result.method, "local");
  for (const skill of ["react", "node.js", "mongodb", "redis", "playwright", "bullmq", "bm25", "rag"]) assert.ok(result.skills.includes(skill));
});
test("skill boundaries distinguish programming languages and incidental substrings", () => {
  const skills = extractLocalSkills("JavaScript, C++, C#, CSS. A rendering designer using GitHub.");
  assert.ok(skills.includes("javascript"));
  assert.ok(skills.includes("c++"));
  assert.ok(skills.includes("c#"));
  for (const skill of ["java", "c", "git", "render", "r"]) assert.ok(!skills.includes(skill), skill);
});
test("optional AI failures and malformed output fall back to local extraction", async () => {
  for (const generate of [async () => {throw new Error("provider unavailable");}, async () => '[{"skill":"invented"}]', async () => 'not JSON']) {
    const result = await extractResumeSkills("Python and Docker", {useAI:true, generate});
    assert.equal(result.method, "local");
    assert.deepEqual(result.skills.sort(), ["docker", "python"]);
  }
});
test("AI enrichment rejects absent skills and duplicates", async () => {
  const result = await extractResumeSkills("Python and Svelte", {useAI:true,generate:async () => '["Python", "Svelte", "Kubernetes", "Python"]'});
  assert.deepEqual(result.skills.sort(), ["python", "svelte"]);
});
