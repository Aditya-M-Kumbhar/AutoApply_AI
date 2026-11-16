// Keep connection selection identical for the API, workers, and diagnostics.
// Error messages contain variable names, never credential-bearing values.
function resolve(env, primary, legacy, schemes) {
  const current = env[primary]?.trim();
  const previous = env[legacy]?.trim();
  const fail = (message) => {
    const error = new Error(message);
    error.code = "CONNECTION_CONFIG";
    throw error;
  };
  if (current && previous && current !== previous)
    fail(
      `${primary} and ${legacy} contain different values. Keep ${primary} and remove ${legacy}.`,
    );
  const value = current || previous;
  if (!value) fail(`Set ${primary} in backend/.env.`);
  if (!schemes.some((scheme) => value.startsWith(scheme)))
    fail(
      `Invalid ${primary} format. Use ${schemes.join(" or ")} connection syntax${primary === "UPSTASH_REDIS_URL" ? ", not an HTTPS REST endpoint" : ""}.`,
    );
  return { value, variable: current ? primary : legacy };
}
export const mongoConnection = (env = process.env) =>
  resolve(env, "MONGODB_URI", "MONGO_URI", ["mongodb://", "mongodb+srv://"]);
export const redisConnection = (env = process.env) =>
  resolve(env, "UPSTASH_REDIS_URL", "REDIS_URL", ["redis://", "rediss://"]);
