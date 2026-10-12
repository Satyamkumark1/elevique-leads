const DELAYS_MS = [60_000, 5 * 60_000]; // after attempt 1, 2 (TECH_SPEC §7.2)

/** What to do after a failed attempt. `attempts` is the count including the one that just failed. */
export function nextRetry(
  attempts: number,
  maxAttempts: number,
  now: Date,
): { status: "pending"; run_at: string } | { status: "dead" } {
  if (attempts >= maxAttempts) return { status: "dead" };
  const delay = DELAYS_MS[Math.min(attempts, DELAYS_MS.length) - 1];
  return { status: "pending", run_at: new Date(now.getTime() + delay).toISOString() };
}
