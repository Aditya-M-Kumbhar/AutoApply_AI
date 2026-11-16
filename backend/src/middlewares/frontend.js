import express from "express";
import fs from "node:fs";
import path from "node:path";

export function mountFrontend(app, directory) {
  const index = path.join(directory, "index.html");
  if (!fs.existsSync(index))
    throw new Error(
      "The production frontend build is missing. Build frontend/ before starting with SERVE_FRONTEND=true.",
    );
  // Unknown API endpoints must stay JSON errors, not turn into the HTML application.
  app.use(["/api", "/socket.io", "/health"], (req, res) =>
    res.status(404).json({ message: "Endpoint not found." }),
  );
  app.use(
    express.static(directory, {
      index: false,
      setHeaders(res, file) {
        res.setHeader(
          "Cache-Control",
          file.includes(`${path.sep}assets${path.sep}`)
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        );
      },
    }),
  );
  app.get("*", (req, res, next) => {
    if (!req.accepts("html") || path.extname(req.path)) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(index);
  });
}
