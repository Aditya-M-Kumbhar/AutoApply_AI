export const API_BASE = (import.meta.env.VITE_API_URL || "/api/v1").replace(
  /\/$/,
  "",
);
export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (API_BASE.startsWith("http")
    ? new URL(API_BASE).origin
    : window.location.origin);
export async function apiFetch(path, options = {}) {
  try {
    return await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(
      error.name === "TimeoutError"
        ? "The request took too long. Please try again."
        : "We couldn’t reach the server. Check your connection and try again.",
      { cause: error },
    );
  }
}
export async function request(path, options = {}) {
  const response = await apiFetch(path, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("session-expired"));
    throw new Error(
      result.message ||
        `This request couldn’t be completed (${response.status}). Please try again.`,
    );
  }
  return result;
}
export const json = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
export const normalizeUser = (user) => ({
  ...user,
  id: user.id || user._id,
  skills: user.skills?.length ? user.skills : user.profileVault?.skills || [],
});
export const safeLink = (value) => {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};
