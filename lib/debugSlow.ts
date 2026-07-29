// A way to see the long-wait UI without waiting for a genuinely long request.
//
// The problem this solves: the progress bar only appears after several seconds,
// and whether a real tailoring takes four seconds or forty depends on the model
// that day. Clicking buttons hoping to catch a slow one is not a test.
//
// Setting the flag makes the client hold every tracked response for that many
// milliseconds before using it. The request really was made and really did
// return - only the handling is delayed - so the UI goes through exactly the
// states it would on a slow day.
//
//   localStorage.setItem('vantage-slow', '25000')   // 25 second waits
//   localStorage.removeItem('vantage-slow')         // back to normal
//
// Inert unless the flag is set, so it costs a localStorage read per request and
// nothing else.

const FLAG = 'vantage-slow';

/** The configured delay in ms, or 0 when the flag is not set. */
export function debugSlowMs(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const value = Number(localStorage.getItem(FLAG));
    // Capped: a typo of one extra zero should not wedge the page for an hour.
    return Number.isFinite(value) && value > 0 ? Math.min(value, 120_000) : 0;
  } catch {
    return 0;
  }
}

/** Waits out the configured delay. Returns immediately when unset. */
export async function debugSlow(): Promise<void> {
  const ms = debugSlowMs();
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
}
