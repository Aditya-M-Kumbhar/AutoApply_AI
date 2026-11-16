// Local lexical retrieval: no provider calls, API keys, or per-query embedding costs.
const aliases = new Map(
  Object.entries({
    js: "javascript",
    ts: "typescript",
    reactjs: "react",
    "react.js": "react",
    nodejs: "node.js",
    node: "node.js",
    postgres: "postgresql",
    "amazon web services": "aws",
    "machine learning": "machine-learning",
    "c sharp": "c#",
    "c plus plus": "c++",
  }),
);
const stops = new Set(
  "a an the and or for with to of in on at is are be this that you your i my me find show which what how can do does about roles jobs job looking want need have has from as it using based more please".split(
    " ",
  ),
);
export const cleanText = (value) =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&amp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export function canonicalSkill(value) {
  const text = cleanText(value).toLowerCase().trim();
  return aliases.get(text) || text;
}
export function tokenizeSearch(value) {
  let text = cleanText(value).toLowerCase();
  for (const [alias, canonical] of [...aliases].sort(
    (a, b) => b[0].length - a[0].length,
  ))
    text = text.replace(
      new RegExp(`(?<![a-z0-9.+#])${escapeRegex(alias)}(?![a-z0-9.+#])`, "g"),
      canonical,
    );
  return (
    text.match(/\.?[a-z0-9]+(?:[.+#-][a-z0-9]+)*(?:\+\+|#)?/g) || []
  ).filter((token) => !stops.has(token));
}
export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export function skillMatches(skill, text) {
  const canonical = canonicalSkill(skill);
  const tokens = tokenizeSearch(text).join(" ");
  const phrase = tokenizeSearch(canonical).join(" ");
  return (
    Boolean(phrase) &&
    new RegExp(`(?:^| )${escapeRegex(phrase)}(?: |$)`).test(tokens)
  );
}
export function explainMatch(job, userSkills = []) {
  const skills = [...new Set(userSkills.map(canonicalSkill).filter(Boolean))];
  const required = [
    ...new Set((job.skillsRequired || []).map(canonicalSkill).filter(Boolean)),
  ];
  const searchable = `${job.title || ""} ${job.description || ""}`;
  const matched = required.length
    ? required.filter((skill) => skills.includes(skill))
    : skills.filter((skill) => skillMatches(skill, searchable));
  const missing = required.filter((skill) => !skills.includes(skill));
  const denominator = required.length || skills.length;
  return {
    fitScore:
      skills.length && denominator
        ? Math.round((matched.length / denominator) * 100)
        : 0,
    matchedSkills: matched,
    missingSkills: missing,
    basis: required.length ? "listed-requirements" : "description-overlap",
    hasProfile: skills.length > 0,
  };
}
export function createIndex(documents, getText = (document) => document.text) {
  const frequency = new Map();
  const entries = documents.map((document) => {
    const tokens = tokenizeSearch(getText(document));
    const counts = new Map();
    for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
    for (const token of counts.keys())
      frequency.set(token, (frequency.get(token) || 0) + 1);
    return { document, counts, length: tokens.length };
  });
  return {
    entries,
    frequency,
    averageLength:
      entries.reduce((sum, entry) => sum + entry.length, 0) /
        (entries.length || 1) || 1,
  };
}
export function searchIndex(index, query) {
  const tokens = [...new Set(tokenizeSearch(query))];
  const count = index.entries.length;
  return index.entries.map((entry) => {
    let score = 0;
    for (const token of tokens) {
      const tf = entry.counts.get(token) || 0;
      if (!tf) continue;
      const df = index.frequency.get(token) || 0;
      const idf = Math.log(1 + (count - df + 0.5) / (df + 0.5));
      score +=
        (idf * tf * 2.2) /
        (tf + 1.2 * (0.25 + (0.75 * entry.length) / index.averageLength));
    }
    return { document: entry.document, score };
  });
}
export function rankJobs(
  jobs,
  { query = "", skills = [], sort = "recommended", now = Date.now() } = {},
) {
  const hasQuery = tokenizeSearch(query).length > 0;
  const lexical = hasQuery
    ? searchIndex(
        createIndex(
          jobs,
          (job) =>
            `${job.title} ${job.title} ${job.title} ${job.company} ${Array(4)
              .fill((job.skillsRequired || []).join(" "))
              .join(" ")} ${job.description || ""} ${job.location || ""}`,
        ),
        query,
      )
    : jobs.map((document) => ({ document, score: 0 }));
  const max = Math.max(1, ...lexical.map((item) => item.score));
  return lexical
    .filter((item) => !hasQuery || item.score > 0)
    .map(({ document: job, score }) => {
      const match = explainMatch(job, skills);
      const age = Math.max(
        0,
        (now - (Date.parse(job.postedAt) || 0)) / 86400000,
      );
      const freshness = 1 / (1 + age / 30);
      const rankScore = hasQuery
        ? (0.65 * score) / max + (0.3 * match.fitScore) / 100 + 0.05 * freshness
        : skills.length
          ? (0.95 * match.fitScore) / 100 + 0.05 * freshness
          : freshness;
      return {
        ...job,
        fitScore: match.fitScore,
        matchExplanation: match,
        rankScore: Number(rankScore.toFixed(6)),
      };
    })
    .sort(
      (a, b) =>
        (sort === "newest"
          ? (Date.parse(b.postedAt) || 0) - (Date.parse(a.postedAt) || 0)
          : b.rankScore - a.rankScore) ||
        String(a._id).localeCompare(String(b._id)),
    );
}
export function chunkJobs(jobs) {
  return jobs.flatMap((job) => {
    const text = cleanText(job.description);
    const chunks = [];
    const metadata = `${job.title}. ${job.company}. Location: ${job.location}. Listed skills: ${(job.skillsRequired || []).join(", ")}. Salary: ${job.salaryRange || "Not disclosed"}.`;
    for (let offset = 0; offset < Math.max(text.length, 1); offset += 700)
      chunks.push({
        job,
        text: `${metadata} ${text.slice(offset, offset + 850)}`,
        offset,
      });
    return chunks;
  });
}
export function retrieveEvidence(jobs, question, topK = 5) {
  const ranked = searchIndex(createIndex(chunkJobs(jobs)), question)
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const seen = new Set();
  const selected = [];
  for (const item of ranked) {
    const id = String(item.document.job._id);
    if (seen.has(id)) continue;
    seen.add(id);
    selected.push(item);
    if (selected.length === topK) break;
  }
  return selected.map(({ document, score }, index) => ({
    id: `S${index + 1}`,
    jobId: String(document.job._id),
    title: document.job.title,
    company: document.job.company,
    location: document.job.location,
    url: document.job.applyLink,
    excerpt: document.text,
    score: Number(score.toFixed(4)),
  }));
}
