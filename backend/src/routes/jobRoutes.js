import express from "express";
import { z } from "zod";
import Job from "../models/Job.js";
import User from "../models/User.js";
import { protect } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../middlewares/errorMiddleware.js";
import { getCatalog } from "../services/catalogService.js";
import { explainMatch, rankJobs } from "../services/retrievalEngine.js";

const router = express.Router();
const querySchema = z.object({
  search: z.string().trim().max(200).optional().default(""),
  location: z.string().trim().max(100).optional().default(""),
  sourcePlatform: z.string().trim().max(80).optional().default(""),
  minScore: z.coerce.number().min(0).max(100).optional().default(0),
  page: z.coerce.number().int().min(1).max(100000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  sort: z.enum(["recommended", "newest"]).optional().default("recommended"),
});
router.get(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    const query = querySchema.parse(req.query);
    const [user, catalog] = await Promise.all([
      User.findById(req.user.id).select("skills profileVault.skills").lean(),
      getCatalog(),
    ]);
    if (!user)
      return res
        .status(401)
        .json({
          message: "Your account is no longer available. Please sign in again.",
        });
    const skills = user.skills?.length
      ? user.skills
      : user.profileVault?.skills || [];
    const candidates = catalog.jobs.filter(
      (job) =>
        (!query.location ||
          String(job.location || "")
            .toLowerCase()
            .includes(query.location.toLowerCase())) &&
        (!query.sourcePlatform || job.sourcePlatform === query.sourcePlatform),
    );
    const ranked = rankJobs(candidates, {
      query: query.search,
      skills,
      sort: query.sort,
    }).filter((job) => job.fitScore >= query.minScore);
    const pages = Math.max(1, Math.ceil(ranked.length / query.limit));
    const page = Math.min(query.page, pages);
    res.json({
      status: "success",
      data: {
        jobs: ranked.slice((page - 1) * query.limit, page * query.limit),
        pagination: { page, limit: query.limit, total: ranked.length, pages },
        retrieval: {
          method: "bm25-skill-overlap",
          personalized: skills.length > 0,
          candidateCount: catalog.jobs.length,
          candidateLimit: catalog.candidateLimit,
          truncated: catalog.truncated,
          cachedForSeconds: 30,
        },
      },
    });
  }),
);
router.get(
  "/:id",
  protect,
  asyncHandler(async (req, res) => {
    const [job, user] = await Promise.all([
      Job.findById(req.params.id).lean(),
      User.findById(req.user.id).select("skills profileVault.skills").lean(),
    ]);
    if (!job) return res.status(404).json({ message: "Job not found." });
    const match = explainMatch(
      job,
      user?.skills?.length ? user.skills : user?.profileVault?.skills || [],
    );
    res.json({
      status: "success",
      data: { ...job, fitScore: match.fitScore, matchExplanation: match },
    });
  }),
);
export default router;
