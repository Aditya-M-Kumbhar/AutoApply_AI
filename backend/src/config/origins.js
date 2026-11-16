export function isAllowedOrigin(origin, env = process.env) {
  if (!origin) return true;
  const configured = [
    env.RENDER_EXTERNAL_URL,
    ...(env.CLIENT_ORIGIN || "").split(","),
  ]
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value.trim()).origin;
      } catch {
        return null;
      }
    });
  return (
    configured.includes(origin) ||
    (env.NODE_ENV !== "production" &&
      /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  );
}
