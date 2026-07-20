// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeOutcomes, MIN_DECIDED_FOR_INSIGHTS } from '@/lib/outcomes';

// lib/outcomes.ts reads three tables through the service client. These tests
// stub the client so the bucketing math can be exercised without a database.
const mocks = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from(table: string) {
      const result = { data: mocks.tables[table] ?? [] };
      // any: a hand-rolled stub of Supabase's chainable query builder, where
      // every method returns the chain and the chain itself is awaitable.
      // Typing it properly would mean reproducing the whole PostgrestBuilder.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        in: () => chain,
        then: (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return chain;
    },
  }),
}));

interface AppRow {
  status: string;
  role: string | null;
  resume_doc_id: string | null;
  ats_score_id: string | null;
}

/** Builds `count` applications, `responded` of which got a reply. */
function apps(
  count: number,
  responded: number,
  overrides: Partial<AppRow> = {}
): AppRow[] {
  return Array.from({ length: count }, (_, i) => ({
    status: i < responded ? 'interviewing' : 'rejected',
    role: 'Software Engineer',
    resume_doc_id: null,
    ats_score_id: null,
    ...overrides,
  }));
}

beforeEach(() => {
  mocks.tables = {};
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
});

describe('analyzeOutcomes', () => {
  it('returns an empty analysis when there are no applications', async () => {
    const result = await analyzeOutcomes('user-1');
    expect(result.decidedApplications).toBe(0);
    expect(result.confident).toBe(false);
    expect(result.signals).toEqual([]);
  });

  it('excludes still-pending applications from the decided count', async () => {
    mocks.tables.applications = [
      ...apps(4, 2),
      ...apps(10, 0, { status: 'applied' }),
    ];

    const result = await analyzeOutcomes('user-1');
    // Only the 4 decided rows count; the 10 pending ones must not be read as
    // failures, which would drag the response rate from 50% down to 14%.
    expect(result.decidedApplications).toBe(4);
    expect(result.overallResponseRate).toBe(50);
  });

  it('stays unconfident and emits no signals below the threshold', async () => {
    mocks.tables.applications = [
      ...apps(6, 6, { resume_doc_id: 'doc-1' }),
      ...apps(6, 0),
    ];

    const result = await analyzeOutcomes('user-1');
    expect(result.decidedApplications).toBe(12);
    expect(result.decidedApplications).toBeLessThan(MIN_DECIDED_FOR_INSIGHTS);
    expect(result.confident).toBe(false);
    expect(result.signals).toEqual([]);
  });

  it('surfaces a tailored-resume signal once past the threshold', async () => {
    mocks.tables.applications = [
      ...apps(10, 8, { resume_doc_id: 'doc-1' }),
      ...apps(10, 1),
    ];
    mocks.tables.documents = [{ id: 'doc-1', skill_gaps: [] }];

    const result = await analyzeOutcomes('user-1');
    expect(result.confident).toBe(true);
    expect(result.linkedApplications).toBe(10);

    const signal = result.signals.find((s) => s.factor.includes('tailored resume'));
    expect(signal).toBeDefined();
    expect(signal?.respondedRate).toBe(80);
    expect(signal?.comparisonRate).toBe(10);
    expect(signal?.sampleSize).toBe(10);
  });

  it('suppresses a signal when one side of the split is too small', async () => {
    // Only 3 applications carry a resume - below the per-bucket minimum even
    // though the overall sample is past the confidence threshold.
    mocks.tables.applications = [
      ...apps(3, 3, { resume_doc_id: 'doc-1' }),
      ...apps(17, 1),
    ];
    mocks.tables.documents = [{ id: 'doc-1', skill_gaps: [] }];

    const result = await analyzeOutcomes('user-1');
    expect(result.confident).toBe(true);
    expect(result.signals.find((s) => s.factor.includes('tailored resume'))).toBeUndefined();
  });

  it('suppresses a signal when the lift is within the noise', async () => {
    // 40% vs 35% is a real difference in the data but nowhere near large
    // enough to be meaningful at this sample size.
    mocks.tables.applications = [
      ...apps(10, 4, { resume_doc_id: 'doc-1' }),
      ...apps(20, 7),
    ];
    mocks.tables.documents = [{ id: 'doc-1', skill_gaps: [] }];

    const result = await analyzeOutcomes('user-1');
    expect(result.signals.find((s) => s.factor.includes('tailored resume'))).toBeUndefined();
  });

  it('ignores applications whose ATS score is unknown when banding by score', async () => {
    mocks.tables.applications = [
      ...apps(8, 7, { ats_score_id: 'score-high' }),
      ...apps(8, 1, { ats_score_id: 'score-low' }),
      // No score attached - must not be silently bucketed as "below 80".
      ...apps(10, 0),
    ];
    mocks.tables.ats_scores = [
      { id: 'score-high', overall_score: 88 },
      { id: 'score-low', overall_score: 55 },
    ];

    const result = await analyzeOutcomes('user-1');
    const signal = result.signals.find((s) => s.factor.includes('80 or above'));
    expect(signal).toBeDefined();
    expect(signal?.sampleSize).toBe(8);
    expect(signal?.respondedRate).toBe(87.5);
    // 1 of 8, not 1 of 18 - the unscored rows are excluded from both sides.
    expect(signal?.comparisonRate).toBe(12.5);
  });

  it('degrades to an empty analysis instead of throwing when credentials are missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const result = await analyzeOutcomes('user-1');
    expect(result).toEqual({
      decidedApplications: 0,
      linkedApplications: 0,
      overallResponseRate: 0,
      confident: false,
      signals: [],
    });
  });
});
