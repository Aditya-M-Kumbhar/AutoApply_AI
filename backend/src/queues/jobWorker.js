import { Worker } from "bullmq";
import redisManager from "../config/redis.js";
import {
  fetchAdzunaJobs,
  fetchRemotiveJobs,
  fetchMuseJobs,
} from "../services/apiIngestionService.js";
import {
  runStealthCrawl,
  runRealBrowserCrawl,
} from "../services/crawlerService.js";
import logger from "../config/logger.js";
import { getIO } from "../config/socket.js";

// Separate connections for Workers
const connectionApi = redisManager.createConnection();
const connectionCrawl = redisManager.createConnection();

// Worker for API Ingestion
export const apiWorker = new Worker(
  "api-ingestion-queue",
  async (job) => {
    logger.info(
      `[BullMQ Worker] Dequeuing API Ingestion job: ${job.name} (ID: ${String(job.id)})`,
    );

    try {
      if (job.name === "sync-apis" || job.name === "sync-adzuna") {
        await fetchAdzunaJobs();
      }
      if (job.name === "sync-apis" || job.name === "sync-remotive") {
        await fetchRemotiveJobs();
      }
      if (job.name === "sync-apis" || job.name === "sync-themuse") {
        await fetchMuseJobs();
      }

      const io = getIO();
      if (io) {
        // Broadcast sync complete to socket clients
        io.emit("sync_complete", {
          message: "All job sources synchronized successfully.",
          timestamp: Date.now(),
        });
      }

      logger.info(
        `[BullMQ Worker] API Ingestion job ${String(job.id)} completed.`,
      );
    } catch (err) {
      logger.error(
        `[BullMQ Worker] API Ingestion job ${String(job.id)} failed: ${err.message}`,
      );
      throw err;
    }
  },
  {
    connection: connectionApi,
    concurrency: 1,
  },
);

// Worker for Crawler/Scraping
export const crawlerWorker = new Worker(
  "crawler-queue",
  async (job) => {
    const { url, sourcePlatform, roomId, mode, companyOverride } = job.data;

    try {
      if (mode === "Real Browser") {
        await runRealBrowserCrawl(
          url,
          sourcePlatform,
          roomId,
          10,
          companyOverride,
        );
      } else {
        await runStealthCrawl(url, sourcePlatform, roomId, 10, companyOverride);
      }

      const io = getIO();
      if (io && roomId) {
        io.to(roomId).emit("crawl_complete", {
          message: "Crawl job finished successfully.",
          timestamp: Date.now(),
        });
      }

      logger.info(`[BullMQ Worker] Crawl job ${String(job.id)} completed.`);
    } catch (err) {
      logger.error(
        `[BullMQ Worker] Crawl job ${String(job.id)} failed: ${err.message}`,
      );
      const io = getIO();
      if (io && roomId) {
        io.to(roomId).emit("crawl_log", {
          message: `Crawl error: ${err.message}`,
          timestamp: Date.now(),
        });
      }
      throw err;
    }
  },
  {
    connection: connectionCrawl,
    concurrency: Math.min(
      4,
      Math.max(
        1,
        Number.parseInt(process.env.CRAWLER_CONCURRENCY, 10) ||
          (process.env.NODE_ENV === "production" ? 1 : 2),
      ),
    ),
  },
);

// Event attachments
let lastWorkerError = 0;
const logWorkerError = (error) => {
  if (Date.now() - lastWorkerError < 60000) return;
  lastWorkerError = Date.now();
  logger.warn(
    `Background workers are reconnecting (${error.code || error.name}).`,
  );
};
apiWorker.on("error", logWorkerError);
crawlerWorker.on("error", logWorkerError);
apiWorker.on("failed", (job, err) => {
  logger.error(
    `[ApiWorker] Job ${job ? String(job.id) : "unknown"} failed: ${err.message}`,
  );
});

crawlerWorker.on("failed", (job, err) => {
  logger.error(
    `[CrawlerWorker] Job ${job ? String(job.id) : "unknown"} failed: ${err.message}`,
  );
});
