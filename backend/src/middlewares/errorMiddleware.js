import { ZodError } from "zod";
import logger from "../config/logger.js";

// Asynchronous handler wrapper to avoid try-catch boilerplate in controllers
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const errorHandler = (err, req, res, next) => {
  // Log the complete stack trace for server diagnostics
  logger.error(`Error intercepted: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
    // Request bodies can contain passwords, resumes, or private drafts.
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      status: "error",
      code: "VALIDATION_ERROR",
      message: "Invalid request data payload.",
      errors: err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }

  // Handle Mongoose cast errors (invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({
      status: "error",
      code: "CAST_ERROR",
      message: `Invalid identifier format for field: ${err.path}`,
    });
  }

  // Handle Mongoose duplicate key errors
  if (err.code === 11000) {
    const fieldName = Object.keys(err.keyValue || {})[0] || "field";
    return res.status(409).json({
      status: "error",
      code: "DUPLICATE_KEY_ERROR",
      message: `A record with this ${fieldName} already exists.`,
    });
  }

  // Handle standard payload error (like JSON parsing issues)
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      status: "error",
      code: "BAD_REQUEST",
      message: "Malformed JSON payload.",
    });
  }

  // Default to 500 Internal Server Error
  const statusCode = err.statusCode || 500;
  const message =
    statusCode === 500
      ? "A critical internal server error occurred."
      : err.message;

  res.status(statusCode).json({
    status: "error",
    code: err.code || "INTERNAL_SERVER_ERROR",
    message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};
