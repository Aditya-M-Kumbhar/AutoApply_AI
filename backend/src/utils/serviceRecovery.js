// Background recovery is independent of the timeout on an individual HTTP request.
export const retryDelay = (attempt) =>
  Math.min(1000 * 2 ** Math.min(Math.max(0, attempt - 1), 4), 10000);

export function startRecovery({
  recover,
  intervalMs = 10000,
  onError = () => {},
}) {
  let stopped = false;
  let pending = false;
  const tick = async () => {
    if (stopped || pending) return;
    pending = true;
    try {
      await recover();
    } catch (error) {
      onError(error);
    } finally {
      pending = false;
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  return {
    tick,
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
