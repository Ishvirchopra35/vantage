import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { rateLimitMessage } from '@/lib/rateLimitMessage';

describe('rateLimitMessage', () => {
  it('renders minutes for sub-hour waits', () => {
    expect(rateLimitMessage(120)).toBe(
      "You've reached the daily limit for this feature. Try again in 2 minutes.",
    );
  });

  it('renders a singular minute', () => {
    expect(rateLimitMessage(30)).toContain('in 1 minute.');
  });

  it('renders hours once the wait reaches an hour', () => {
    expect(rateLimitMessage(3600)).toContain('in 1 hour.');
    expect(rateLimitMessage(7200)).toContain('in 2 hours.');
  });

  it('rounds partial hours up', () => {
    expect(rateLimitMessage(3660)).toContain('in 2 hours.');
  });

  it('defaults to 24 hours when retryAfter is missing or zero', () => {
    expect(rateLimitMessage()).toContain('in 24 hours.');
    expect(rateLimitMessage(0)).toContain('in 24 hours.');
  });

  it('property: always a non-empty message ending in minutes or hours', () => {
    fc.assert(
      fc.property(fc.nat({ max: 200000 }), (retryAfter) => {
        const msg = rateLimitMessage(retryAfter);
        expect(msg).toMatch(/^You've reached the daily limit/);
        expect(msg).toMatch(/in \d+ (minute|minutes|hour|hours)\.$/);
      }),
      { numRuns: 200 },
    );
  });
});
