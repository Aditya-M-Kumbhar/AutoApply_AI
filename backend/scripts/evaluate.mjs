import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { jobs, cases } from "../evals/fixtures.js";
import { retrieveEvidence } from "../src/services/retrievalEngine.js";
import { answerQuestion, validateAnswer } from "../src/services/ragService.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });
const live = process.argv.includes("--live");
let generate;
if (live)
  generate = (await import("../src/services/aiService.js")).generateText;
const dcg = (grades) =>
  grades.reduce(
    (sum, grade, index) => sum + (2 ** grade - 1) / Math.log2(index + 2),
    0,
  );
const measurements = [];
const caseIndex = process.argv.indexOf("--case");
const selectedCases =
  caseIndex < 0
    ? cases
    : cases.filter((item) => item.id === process.argv[caseIndex + 1]);
if (!selectedCases.length)
  throw new Error("Unknown --case. Choose a case ID from evals/fixtures.js.");
for (const item of selectedCases) {
  const started = performance.now();
  const sources = retrieveEvidence(jobs, item.question, 3);
  const ids = sources.map((source) => source.jobId);
  const relevant = Object.keys(item.relevance);
  const hits = ids.filter((id) => item.relevance[id] > 0).length;
  const first = ids.findIndex((id) => item.relevance[id] > 0);
  const ideal = Object.values(item.relevance)
    .sort((a, b) => b - a)
    .slice(0, 3);
  const row = {
    id: item.id,
    retrieved: ids,
    precisionAt3: hits / 3,
    recallAt3: relevant.length ? hits / relevant.length : null,
    reciprocalRank: relevant.length ? (first < 0 ? 0 : 1 / (first + 1)) : null,
    ndcgAt3: ideal.length
      ? dcg(ids.map((id) => item.relevance[id] || 0)) / dcg(ideal)
      : null,
    correctEmpty: relevant.length ? null : sources.length === 0,
    retrievalMs: Number((performance.now() - started).toFixed(3)),
  };
  if (live) {
    const answer = await answerQuestion({
      question: item.question,
      jobs,
      generate,
      topK: 3,
    });
    row.generation = {
      mode: answer.mode,
      abstained: answer.abstained,
      claims: answer.claims,
      citationChecks: answer.checks,
      answer: answer.answer,
    };
  }
  measurements.push(row);
}
const source = retrieveEvidence(jobs, "React", 1);
const checks = [
  {
    id: "unknown-source-rejected",
    passed:
      validateAnswer(
        JSON.stringify({
          abstained: false,
          claims: [
            {
              text: "Invented",
              sourceIds: ["S99"],
              evidence: [{ sourceId: "S99", quote: "Not in a source" }],
            },
          ],
        }),
        source,
      ) === null,
  },
  {
    id: "invented-quote-rejected",
    passed:
      validateAnswer(
        JSON.stringify({
          abstained: false,
          claims: [
            {
              text: "Invented",
              sourceIds: ["S1"],
              evidence: [
                {
                  sourceId: "S1",
                  quote: "Guaranteed visa sponsorship for every applicant",
                },
              ],
            },
          ],
        }),
        source,
      ) === null,
  },
  {
    id: "invalid-json-rejected",
    passed: validateAnswer("Here is a response without JSON", source) === null,
  },
  {
    id: "explicit-abstention-accepted",
    passed:
      validateAnswer('{"claims":[],"abstained":true}', source)?.abstained ===
      true,
  },
];
const mean = (key) => {
  const values = measurements
    .filter((row) => row[key] !== null)
    .map((row) => row[key]);
  return Number(
    (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4),
  );
};
const report = {
  dataset: "synthetic-career-catalog-v1",
  mode: live ? "live-generation" : "offline-retrieval-and-validator",
  caseCount: selectedCases.length,
  metrics: {
    precisionAt3: mean("precisionAt3"),
    recallAt3: mean("recallAt3"),
    mrr: mean("reciprocalRank"),
    ndcgAt3: mean("ndcgAt3"),
    meanRetrievalMs: mean("retrievalMs"),
  },
  validatorChecks: checks,
  cases: measurements,
  limitations: [
    "Small synthetic dataset; scores are not production relevance estimates.",
    "Quote and citation validation checks provenance, not semantic entailment.",
    "Offline mode makes no LLM calls and does not measure model quality.",
    "Live mode sends synthetic job excerpts to configured AI providers; inspect outputs for faithfulness and usefulness.",
  ],
};
const index = process.argv.indexOf("--output");
if (index >= 0) {
  const output = path.resolve(process.argv[index + 1]);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
if (
  checks.some((check) => !check.passed) ||
  report.metrics.recallAt3 < 0.8 ||
  measurements.some((row) => row.correctEmpty === false) ||
  (live &&
    measurements.some(
      (row) =>
        row.generation.mode !== "generated" &&
        Object.keys(cases.find((item) => item.id === row.id).relevance).length,
    ))
)
  process.exitCode = 1;
if (live) (await import("../src/config/redis.js")).default.client?.disconnect();
