import mongoose from "mongoose";
import logger from "./logger.js";
import { mongoConnection } from "./connections.js";

export const connectDB = async () => {
  try {
    const { value: MONGO_URI } = mongoConnection();
    const conn = await mongoose.connect(MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    logger.info(`MongoDB Connected successfully: ${conn.connection.host}`);
  } catch (error) {
    if (error.code === "CONNECTION_CONFIG") logger.error(error.message);
    logger.error(
      `Database connection failed (${error.code || error.name}). Check the configured MongoDB connection and run npm run diagnose.`,
    );
    throw error;
  }
};

mongoose.connection.on("disconnected", () => {
  logger.warn(
    "MongoDB is disconnected. Check /health and run npm run diagnose.",
  );
});

mongoose.connection.on("error", (err) => {
  logger.error(`MongoDB internal connection error: ${err.message}`, err);
});
