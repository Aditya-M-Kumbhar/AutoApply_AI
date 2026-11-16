import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { protect } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../middlewares/errorMiddleware.js";
import { getCatalog } from "../services/catalogService.js";
import { answerQuestion } from "../services/ragService.js";
import { generateText } from "../services/aiService.js";

const router = express.Router();
const schema = z.object({
  question: z.string().trim().min(3).max(500),
  useAI: z.boolean().optional().default(false),
});
const limiter = rateLimit({
  windowMs: 60000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Please wait a minute before asking more questions." },
});
router.post(
  "/ask",
  protect,
  limiter,
  asyncHandler(async (req, res) => {
    const { question, useAI } = schema.parse(req.body);
    const catalog = await getCatalog();
    const result = await answerQuestion({
      question,
      jobs: catalog.jobs,
      generate: useAI ? generateText : undefined,
    });
    res.json({
      status: "success",
      data: {
        ...result,
        scope: {
          candidateLimit: catalog.candidateLimit,
          truncated: catalog.truncated,
          candidateCount: catalog.jobs.length,
        },
      },
    });
  }),
);
export default router;
