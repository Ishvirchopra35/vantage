// Client-safe helper for turning a 429 response's retryAfter (seconds) into a
// friendly "try again in X" message. Shared by every component that calls a
// rate-limited endpoint so the copy stays consistent.

export function rateLimitMessage(retryAfter?: number): string {
  const minutes = Math.ceil((retryAfter || 86400) / 60);
  const hours = Math.ceil(minutes / 60);
  const timeStr =
    hours >= 1
      ? `${hours} hour${hours !== 1 ? 's' : ''}`
      : `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  return `You've reached the daily limit for this feature. Try again in ${timeStr}.`;
}
