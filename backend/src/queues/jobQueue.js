import { Queue } from "bullmq";
import redisManager from "../config/redis.js";
import logger from "../config/logger.js";

let apiQueueInstance = null;
let crawlerQueueInstance = null;

export const getApiQueue = () => {
  if (!apiQueueInstance) {
    const connection = redisManager.getClient();
    apiQueueInstance = new Queue("api-ingestion-queue", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }
  return apiQueueInstance;
};

export const getCrawlerQueue = () => {
  if (!crawlerQueueInstance) {
    const connection = redisManager.getClient();
    crawlerQueueInstance = new Queue("crawler-queue", {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 10000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }
  return crawlerQueueInstance;
};

// Scheduler initializer
export const initRepeatableJobs = async () => {
  try {
    const apiQueue = getApiQueue();
    // Clean old repeatable jobs to avoid duplicates
    const jobs = await apiQueue.getRepeatableJobs();
    for (const job of jobs) {
      await apiQueue.removeRepeatableByKey(job.key);
    }

    // Add repeatable job scheduler (every 6 hours)
    await apiQueue.add(
      "sync-apis",
      {},
      { repeat: { every: 6 * 60 * 60 * 1000 } },
    );
    logger.info(
      "BullMQ Repeatable sync-apis job registered successfully (fires every 6 hours).",
    );
  } catch (error) {
    logger.error(`Failed to register BullMQ repeatable jobs: ${error.message}`);
    throw error;
  }
};
