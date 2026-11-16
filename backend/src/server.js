import "./config/environment.js";

import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";

import { connectDB } from "./config/db.js";
import redisManager from "./config/redis.js";
import logger from "./config/logger.js";
import { errorHandler, asyncHandler } from "./middlewares/errorMiddleware.js";
import { getTokenAnalytics } from "./services/aiService.js";
import authRouter from "./routes/api/v1/auth.js";
import { initSocket } from "./config/socket.js";
import jobRouter from "./routes/jobRoutes.js";
import marketRouter from "./routes/marketRoutes.js";
import applicationRouter from "./routes/applicationRoutes.js";
import emailRouter from "./routes/emailRoutes.js";
import profileRouter from "./routes/profileRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import { ensureSearchIndex } from "./utils/searchIndex.js";
import assistantRouter from "./routes/assistantRoutes.js";
import { startRecovery } from "./utils/serviceRecovery.js";
import path from "node:path";
import { backendRoot } from "./config/paths.js";
import { isAllowedOrigin } from "./config/origins.js";
import { mountFrontend } from "./middlewares/frontend.js";

const app = express();
const server = http.createServer(app);
const startup = {
  database: "starting",
  redis: "starting",
  workers: "starting",
};
let workers;
let recovery;
let mongoConnectedOnce = false;
mongoose.connection.on("connected", () => {
  mongoConnectedOnce = true;
  startup.database = "connected";
});

const enableWorkers = async () => {
  if (process.env.ENABLE_WORKERS === "false") {
    startup.workers = "disabled";
    return;
  }
  if (
    startup.workers === "enabled" ||
    mongoose.connection.readyState !== 1 ||
    redisManager.client?.status !== "ready"
  )
    return;
  try {
    workers = await import("./queues/jobWorker.js");
    const { initRepeatableJobs } = await import("./queues/jobQueue.js");
    await initRepeatableJobs();
    startup.workers = "enabled";
  } catch {
    startup.workers = "unavailable";
  }
};

const initializeServices = async () => {
  const mongo = connectDB()
    .then(async () => {
      startup.database = "connected";
      await ensureSearchIndex();
    })
    .catch(() => {
      startup.database = "unavailable";
    });
  const redis = (async () => {
    const client = redisManager.getClient();
    if (client.status !== "ready")
      await new Promise((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timer);
          client.off("ready", ready);
          client.off("end", ended);
        };
        const ready = () => {
          cleanup();
          resolve();
        };
        const ended = () => {
          cleanup();
          reject(new Error("Redis connection unavailable"));
        };
        const timer = setTimeout(ended, 7000);
        client.once("ready", ready);
        client.once("end", ended);
      });
    await client.ping();
    startup.redis = "connected";
  })().catch((error) => {
    if (error.code === "CONNECTION_CONFIG") logger.error(error.message);
    startup.redis = "unavailable";
  });
  await Promise.all([mongo, redis]);
  await enableWorkers();
  recovery = startRecovery({
    recover: async () => {
      // After a successful connection the MongoDB driver handles reconnection itself.
      // Initial failed connection attempts need an explicit retry.
      if (!mongoConnectedOnce && mongoose.connection.readyState === 0) {
        try {
          await connectDB();
          await ensureSearchIndex();
        } catch {
          startup.database = "unavailable";
        }
      }
      await enableWorkers();
    },
    onError: () =>
      logger.warn("Service recovery will retry in the background."),
  });
};

// Resilient startup
const startServer = async () => {
  // Initialize Socket.IO
  initSocket(server);

  // Security headers
  app.use(helmet());
  if (process.env.TRUST_PROXY_HOPS) {
    const hops = Number(process.env.TRUST_PROXY_HOPS);
    if (!Number.isInteger(hops) || hops < 1 || hops > 5)
      throw new Error("TRUST_PROXY_HOPS must be an integer from 1 to 5.");
    app.set("trust proxy", hops);
  }

  // CORS config to support dynamic local development ports and whitelisted CLIENT_ORIGIN
  app.use(
    cors({
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          return callback(null, true);
        }
        return callback(new Error("CORS blocked origin"), false);
      },
      credentials: true,
    }),
  );

  // Parse cookies
  app.use(cookieParser());

  // Body parsing with size restrictions to prevent payload injection crashes
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Serve static files from the public directory
  app.use(express.static("public"));

  // Global Rate Limiter
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: "error",
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests, please try again later.",
    },
  });
  app.use("/api/", globalLimiter);

  app.get("/health/live", (req, res) => res.json({ status: "alive" }));
  // Readiness remains available even if a dependency fails to connect.
  app.get(
    "/health",
    asyncHandler(async (req, res) => {
      const database =
        mongoose.connection.readyState === 1
          ? "connected"
          : startup.database === "starting"
            ? "starting"
            : "unavailable";
      const redis =
        redisManager.client?.status === "ready"
          ? "connected"
          : startup.redis === "starting"
            ? "starting"
            : "unavailable";
      const ready = database === "connected" && redis === "connected";
      const tokenAnalytics =
        redis === "connected" ? await getTokenAnalytics() : null;
      res.status(ready ? 200 : 503).json({
        status: ready ? "ready" : "degraded",
        timestamp: new Date(),
        services: {
          database,
          redis,
          workers:
            startup.workers === "enabled" && !ready
              ? "reconnecting"
              : startup.workers,
        },
        aiAnalytics: tokenAnalytics,
      });
    }),
  );

  // Local static mock endpoints for offline E2E diagnostics
  app.get("/mock-form", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Mock Job Form</title></head>
      <body>
        <h1 class="job-title">Software Engineer</h1>
        <h2 class="company-name">Acme Corp</h2>
        <div class="description">We are looking for a Software Engineer to join our team. Must know JavaScript.</div>
        <form action="/submit-success" method="POST">
          <label>Name: <input type="text" id="name" name="fullname" /></label>
          <label>Email: <input type="email" id="email" name="email_address" /></label>
          <button type="submit">Submit</button>
        </form>
      </body>
      </html>
    `);
  });

  app.post("/submit-success", (req, res) => {
    res.send("Success!");
  });

  // Base API router declaration
  const apiRouter = express.Router();

  apiRouter.get("/status", (req, res) => {
    res.json({ status: "Auto Apply AI API reachable", readiness: "/health" });
  });

  apiRouter.use((req, res, next) => {
    if (mongoose.connection.readyState !== 1)
      return res.status(503).json({
        code: "DATABASE_UNAVAILABLE",
        message:
          "The database is unavailable. Check backend configuration with npm run diagnose.",
      });
    if (
      /^\/auth\/(login|register|refresh)$|^\/admin\/(sync-apis|crawl)$/.test(
        req.path,
      ) &&
      redisManager.client?.status !== "ready"
    )
      return res.status(503).json({
        code: "REDIS_UNAVAILABLE",
        message:
          "The session or queue service is unavailable. Check the Redis connection with npm run diagnose.",
      });
    next();
  });

  // Mount Auto Apply AI routers
  apiRouter.use("/auth", authRouter);
  apiRouter.use("/jobs", jobRouter);
  apiRouter.use("/market", marketRouter);
  apiRouter.use("/applications", applicationRouter);
  apiRouter.use("/email", emailRouter);
  apiRouter.use("/profile", profileRouter);
  apiRouter.use("/admin", adminRouter);
  apiRouter.use("/assistant", assistantRouter);

  // Mount on both paths for resilience
  app.use("/api", apiRouter);
  app.use("/api/v1", apiRouter);

  if (process.env.SERVE_FRONTEND === "true")
    mountFrontend(
      app,
      path.resolve(
        process.env.FRONTEND_DIST ||
          path.join(backendRoot, "..", "frontend", "dist"),
      ),
    );

  // Centralized Error Catcher Middleware (must be registered last)
  app.use(errorHandler);

  // Listen on port
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, process.env.HOST, () => {
    logger.info(`AutoApply AI Server operating on port ${PORT}`);
    initializeServices().catch(() =>
      logger.error("Service initialization failed. Run npm run diagnose."),
    );
  });
};

// Graceful termination handling
const shutdown = async () => {
  recovery?.stop();
  logger.info("Closing the API and background services...");
  if (workers)
    await Promise.allSettled([
      workers.apiWorker.close(true),
      workers.crawlerWorker.close(true),
    ]);
  redisManager.client?.disconnect();
  await mongoose.disconnect();
  server.close(async () => {
    logger.info("Server cleanly terminated.");
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

startServer().catch((error) => {
  logger.error(
    `Critical error during server initialization bootstrap: ${error.message}`,
    error,
  );
  process.exit(1);
});
// Nodemon trigger comment for .env change (v4)
