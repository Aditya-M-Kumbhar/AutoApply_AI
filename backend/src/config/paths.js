import path from "node:path";
import { fileURLToPath } from "node:url";
export const backendRoot = fileURLToPath(new URL("../../", import.meta.url));
export const resolveResumeDirectory = (env = process.env) =>
  path.resolve(env.UPLOAD_DIR || path.join(backendRoot, "uploads", "resumes"));
export const resumeDirectory = resolveResumeDirectory();
