import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { sessionProgress } from '@/lib/interviewProgress';

describe('sessionProgress', () => {
  it.each([
    [0, 0, 'not_started'],
    [0, 5, 'not_started'],
    [1, 5, 'in_progress'],
    [4, 5, 'in_progress'],
    [5, 5, 'complete'],
    [1, 1, 'complete'],
  ] as const)('classifies assessed=%i total=%i as %s', (assessed, total, expected) => {
    expect(sessionProgress(assessed, total)).toBe(expected);
  });

  it('property: any non-negative counts with assessed <= total hit the exact thresholds', () => {
    // total in [0, 1000]; assessed clamped to [0, total].
    const countsArb = fc
      .tuple(fc.nat({ max: 1000 }), fc.nat({ max: 1000 }))
      .map(([total, a]) => ({ total, assessed: total === 0 ? 0 : a % (total + 1) }));

    fc.assert(
      fc.property(countsArb, ({ assessed, total }) => {
        const result = sessionProgress(assessed, total);
        if (total === 0 || assessed === 0) {
          expect(result).toBe('not_started');
        } else if (assessed >= total) {
          expect(result).toBe('complete');
        } else {
          expect(result).toBe('in_progress');
        }
      }),
      { numRuns: 100 },
    );
  });
});
