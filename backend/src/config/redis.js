import Redis from "ioredis";
import logger from "./logger.js";
import { redisConnection } from "./connections.js";
import { retryDelay } from "../utils/serviceRecovery.js";

const observeConnection = (client, label) => {
  let lastError = 0;
  client.on("error", (error) => {
    if (Date.now() - lastError < 60000) return;
    lastError = Date.now();
    logger.warn(
      `${label} connection interrupted (${error.code || error.name}). Retrying in the background.`,
    );
  });
  client.on("ready", () => {
    lastError = 0;
    logger.info(`${label} connection ready.`);
  });
  return client;
};

class RedisManager {
  constructor() {
    this.client = null;
  }

  getClient() {
    const { value: REDIS_URL } = redisConnection();
    const options = {
      // HTTP requests must fail promptly; workers get their own unlimited-retry connection.
      maxRetriesPerRequest: 1,
      commandTimeout: 5000,
      connectTimeout: 5000,
      enableOfflineQueue: false,
      retryStrategy: retryDelay,
      enableReadyCheck: true,
      reconnectOnError: (err) => {
        logger.warn(
          `Redis connection error encountered: ${err.message}. Reconnecting...`,
        );
        return true;
      },
      ...(REDIS_URL.startsWith("rediss://") && { tls: {} }),
    };

    if (!this.client) {
      logger.info("Initializing primary Redis connection client...");
      this.client = observeConnection(
        new Redis(REDIS_URL, options),
        "Redis API",
      );
    }
    return this.client;
  }

  // Create a separate connection specifically for BullMQ workers/schedulers
  createConnection() {
    const { value: REDIS_URL } = redisConnection();
    return observeConnection(
      new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
        connectTimeout: 10000,
        retryStrategy: retryDelay,
        enableReadyCheck: true,
        ...(REDIS_URL.startsWith("rediss://") && { tls: {} }),
      }),
      "Redis worker",
    );
  }
}

const redisManager = new RedisManager();
export default redisManager;
