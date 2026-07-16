import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { toAutoApplyList, autoApplyHref, type TrackedApplicationRow } from '@/lib/autoApply';
import { hasRealJobTitle } from '@/lib/jobFilters';

/**
 * A small pool of shared job ids so the generator frequently produces rows
 * that would collapse under a naive dedupe-by-job_id, plus null so
 * manually-logged rows (job_id === null) occur.
 */
const jobIdArb = fc.option(fc.constantFrom('job-a', 'job-b', 'job-c'), { nil: null });

/**
 * `role` spans three buckets to exercise the real-title guard: titles that
 * always pass, placeholders that always fail, and arbitrary strings.
 */
const roleArb = fc.oneof(
  fc.constantFrom('Software Engineer', 'Data Analyst', 'PM'),
  fc.constantFrom('', '  ', 'Untitled job'),
  fc.string(),
);

const rowArb: fc.Arbitrary<TrackedApplicationRow> = fc.record({
  id: fc.uuid(),
  job_id: jobIdArb,
  company: fc.string(),
  role: roleArb,
  // noInvalidDate: fc.date() may otherwise generate NaN dates whose
  // toISOString() throws inside the generator.
  created_at: fc.date({ noInvalidDate: true }).map((d) => d.toISOString()),
});

// Ensure `id` is unique across the set (it is the stable navigation key).
const rowsArb = fc
  .array(rowArb)
  .map((rows) => rows.map((row, i) => ({ ...row, id: `${i}-${row.id}` })));

describe('toAutoApplyList', () => {
  it('property: one entry per real-title row - preserves order, manual rows, and duplicate job_ids', () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        const result = toAutoApplyList(rows);

        // Expected: every row with a real title, in input order, by reference.
        const expected = rows.filter((r) => hasRealJobTitle(r.role));
        expect(result).toEqual(expected);

        // Manual rows (job_id === null) with real titles ARE included.
        for (const manual of expected.filter((r) => r.job_id === null)) {
          expect(result).toContain(manual);
        }

        // Rows sharing a job_id are NOT collapsed: per-job_id counts survive.
        const countByJobId = (list: TrackedApplicationRow[]) => {
          const m = new Map<string, number>();
          for (const r of list) {
            if (r.job_id !== null) m.set(r.job_id, (m.get(r.job_id) ?? 0) + 1);
          }
          return m;
        };
        expect(countByJobId(result)).toEqual(countByJobId(expected));
      }),
      { numRuns: 200 },
    );
  });

  it('drops placeholder-titled rows and keeps real ones', () => {
    const real: TrackedApplicationRow = {
      id: '1', job_id: 'job-a', company: 'Acme', role: 'Software Engineer',
      created_at: '2026-01-01T00:00:00.000Z',
    };
    const placeholder: TrackedApplicationRow = {
      id: '2', job_id: 'job-b', company: 'Acme', role: 'Untitled job',
      created_at: '2026-01-01T00:00:00.000Z',
    };
    expect(toAutoApplyList([placeholder, real])).toEqual([real]);
  });
});

describe('autoApplyHref', () => {
  const anyRowArb: fc.Arbitrary<TrackedApplicationRow> = fc.record({
    id: fc.oneof(fc.uuid(), fc.string({ minLength: 1 })),
    job_id: fc.option(fc.string(), { nil: null }),
    company: fc.string(),
    role: fc.string(),
    created_at: fc.date({ noInvalidDate: true }).map((d) => d.toISOString()),
  });

  it('property: always /apply/${id}, independent of job_id (incl. manual/null rows)', () => {
    fc.assert(
      fc.property(anyRowArb, (row) => {
        const href = autoApplyHref(row);
        expect(href).toBe(`/apply/${row.id}`);
        expect(href.startsWith('/apply/')).toBe(true);

        // job_id must not influence the href.
        expect(autoApplyHref({ ...row, job_id: null })).toBe(href);
        expect(autoApplyHref({ ...row, job_id: 'some-other-job-id' })).toBe(href);
      }),
      { numRuns: 200 },
    );
  });
});
