import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  hasRealJobTitle,
  dedupeByJobId,
  filterTrackedJobs,
  type TrackableJob,
} from '@/lib/jobFilters';

describe('hasRealJobTitle', () => {
  it.each([
    [null],
    [undefined],
    [''],
    ['   '],
    ['.'],
    ['---'],
  ])('returns false for empty/punctuation-only input %j', (title) => {
    expect(hasRealJobTitle(title)).toBe(false);
  });

  it.each([
    ['Untitled job'],
    ['Untitled'],
    ['UNTITLED JOB'],
    ['untitled'],
    ['Unknown'],
    ['N/A'],
    ['na'],
    ['None'],
    ['null'],
    ['Not specified'],
    ['not provided'],
  ])('returns false for the AI placeholder %j (case-insensitive)', (title) => {
    expect(hasRealJobTitle(title)).toBe(false);
  });

  it('returns true for a real job title', () => {
    expect(hasRealJobTitle('Software Engineer')).toBe(true);
  });

  it('returns true for a real title with surrounding whitespace', () => {
    expect(hasRealJobTitle('  Data Analyst  ')).toBe(true);
  });

  it('returns true for short but real titles like "PM"', () => {
    expect(hasRealJobTitle('PM')).toBe(true);
  });
});

describe('dedupeByJobId', () => {
  it('keeps only the first occurrence per jobId and drops null jobIds', () => {
    const a1 = { jobId: 'a', tag: 1 };
    const a2 = { jobId: 'a', tag: 2 };
    const b = { jobId: 'b', tag: 3 };
    const manual = { jobId: null, tag: 4 };
    expect(dedupeByJobId([a1, manual, a2, b])).toEqual([a1, b]);
  });

  it('returns [] for empty input', () => {
    expect(dedupeByJobId([])).toEqual([]);
  });

  it('property: unique, order-preserving, first-occurrence subset of non-null jobIds', () => {
    const rowsArb = fc.array(
      fc.record({
        jobId: fc.option(fc.constantFrom('a', 'b', 'c', 'd'), { nil: null }),
        tag: fc.integer(),
      }),
    );

    fc.assert(
      fc.property(rowsArb, (rows) => {
        const result = dedupeByJobId(rows);

        // Every output jobId is non-null and unique.
        const outIds = result.map((r) => r.jobId);
        for (const id of outIds) expect(id).not.toBeNull();
        expect(new Set(outIds).size).toBe(outIds.length);

        // Output is an in-order subsequence of the input (same references).
        let searchFrom = 0;
        for (const row of result) {
          const idx = rows.indexOf(row, searchFrom);
          expect(idx).toBeGreaterThanOrEqual(0);
          searchFrom = idx + 1;
        }

        // The kept element per jobId is the FIRST input element with that id.
        const firstByJobId = new Map<string, (typeof rows)[number]>();
        for (const row of rows) {
          if (row.jobId != null && !firstByJobId.has(row.jobId)) {
            firstByJobId.set(row.jobId, row);
          }
        }
        expect(result.length).toBe(firstByJobId.size);
        for (const row of result) {
          expect(row).toBe(firstByJobId.get(row.jobId as string));
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe('filterTrackedJobs', () => {
  const idPool = ['id-a', 'id-b', 'id-c', 'id-d', 'id-e'];

  const titleArb = fc.oneof(
    fc.string(),
    fc.constant<string | null>(null),
    fc.constant('  '),
    fc.constant('Untitled job'),
    fc.constant('Software Engineer'),
  );

  const rowArb: fc.Arbitrary<TrackableJob> = fc.record({
    jobId: fc.option(fc.constantFrom(...idPool), { nil: null }),
    title: titleArb,
  });

  it('property: returns only tracked, real-titled rows, preserving order', () => {
    fc.assert(
      fc.property(
        fc.array(rowArb),
        // Draw tracked ids from the same pool to force overlap.
        fc.subarray(idPool),
        (rows, trackedList) => {
          const trackedJobIds = new Set(trackedList);
          const result = filterTrackedJobs(rows, trackedJobIds);

          const predicate = (r: TrackableJob) =>
            r.jobId != null && trackedJobIds.has(r.jobId) && hasRealJobTitle(r.title);

          // Output equals input filtered by the predicate: nothing eligible
          // dropped, nothing ineligible kept, order preserved.
          expect(result).toEqual(rows.filter(predicate));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns [] when nothing is tracked', () => {
    const rows: TrackableJob[] = [{ jobId: 'id-a', title: 'Software Engineer' }];
    expect(filterTrackedJobs(rows, new Set())).toEqual([]);
  });
});
