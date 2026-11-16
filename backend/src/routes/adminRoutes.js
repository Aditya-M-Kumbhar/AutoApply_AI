import express from "express";
import { getApiQueue, getCrawlerQueue } from "../queues/jobQueue.js";
import { testCDPConnection } from "../services/crawlerService.js";
import Job from "../models/Job.js";
import { protect } from "../middlewares/authMiddleware.js";
import { asyncHandler } from "../middlewares/errorMiddleware.js";

const router = express.Router();

// Helper to restrict to admin role
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res
      .status(403)
      .json({ status: "error", message: "Forbidden. Admin access required." });
  }
};

// POST /api/admin/sync-apis - sync all API sources
router.post(
  "/sync-apis",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const apiQueue = getApiQueue();
    const job = await apiQueue.add("sync-apis", {});

    res.status(202).json({
      status: "success",
      message: "API synchronization job successfully enqueued.",
      data: { jobId: String(job.id) },
    });
  }),
);

// POST /api/admin/crawl - trigger crawl
router.post(
  "/crawl",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { url, sourcePlatform, mode, companyOverride } = req.body;
    if (process.env.NODE_ENV === "production" && mode === "Real Browser")
      return res
        .status(409)
        .json({
          message:
            "Real Browser mode is available only in local development. Use headless imports or Sync APIs on the hosted app.",
        });

    if (!url) {
      return res
        .status(400)
        .json({ status: "error", message: "url is required." });
    }

    const roomId = `crawl-${Date.now()}-${Math.round(Math.random() * 1e5)}`;
    const crawlerQueue = getCrawlerQueue();
    const job = await crawlerQueue.add("crawl", {
      url,
      sourcePlatform: sourcePlatform || "Web Scrape",
      roomId,
      mode: mode || "Stealth Headless",
      companyOverride,
    });

    res.status(202).json({
      status: "success",
      message: "Crawl job successfully enqueued.",
      data: {
        jobId: String(job.id),
        roomId,
      },
    });
  }),
);

// POST /api/admin/connect-real-browser - test CDP Chrome connection
router.post(
  "/connect-real-browser",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (process.env.NODE_ENV === "production")
      return res
        .status(409)
        .json({
          message:
            "The hosted app cannot connect to Chrome on your personal computer. Use headless imports or Sync APIs.",
        });
    const connected = await testCDPConnection();
    if (connected) {
      res
        .status(200)
        .json({
          status: "success",
          message:
            "Successfully connected to running Chrome instance on port 9222.",
        });
    } else {
      res
        .status(500)
        .json({
          status: "error",
          message:
            "Failed to connect to Chrome on port 9222. Make sure Chrome is running with remote debugging enabled.",
        });
    }
  }),
);

// GET /api/admin/jobs - list all jobs in system (paginated)
router.get(
  "/jobs",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const jobs = await Job.find()
      .sort({ postedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Job.countDocuments();

    res.status(200).json({
      status: "success",
      data: {
        jobs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  }),
);

// DELETE /api/admin/jobs/:id - deletes a job
router.delete(
  "/jobs/:id",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const job = await Job.findById(id);
    if (!job) {
      return res
        .status(404)
        .json({ status: "error", message: "Job not found." });
    }

    await Job.findByIdAndDelete(id);

    res
      .status(200)
      .json({
        status: "success",
        message: "Job listing deleted successfully.",
      });
  }),
);

export default router;
