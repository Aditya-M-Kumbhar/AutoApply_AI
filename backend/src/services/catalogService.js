import Job from "../models/Job.js";
const LIMIT = 5000;
let cache;
let pending;
export async function getCatalog() {
  if (cache && cache.expires > Date.now()) return cache;
  if (pending) return pending;
  pending = (async () => {
    const documents = await Job.find()
      .sort({ postedAt: -1, _id: 1 })
      .limit(LIMIT + 1)
      .lean();
    cache = {
      jobs: documents.slice(0, LIMIT),
      truncated: documents.length > LIMIT,
      candidateLimit: LIMIT,
      expires: Date.now() + 30000,
    };
    return cache;
  })();
  try {
    return await pending;
  } finally {
    pending = null;
  }
}
export function invalidateCatalog() {
  cache = null;
}
