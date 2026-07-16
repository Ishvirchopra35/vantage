import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseChangelogSource, getChangelog, type ChangelogEntry } from '@/lib/mdx';

// -- Shared generators ----------------------------------------------------------
// Frontmatter string values are constrained to YAML-safe characters and never
// start with a character that would change YAML semantics, so these properties
// target the parser's structural robustness rather than YAML escaping.

const CHANGELOG_TYPES = ['Feature', 'Update', 'Fix', 'Improvement', 'Major Release'] as const;

const SAFE_VALUE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,()/+';
const SAFE_LEADING_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Tokens js-yaml reads as booleans/null rather than strings.
const YAML_KEYWORDS = new Set(['y', 'n', 'yes', 'no', 'true', 'false', 'on', 'off', 'null', '~']);

const safeValueArb = fc
  .tuple(
    fc.constantFrom(...SAFE_LEADING_CHARS.split('')),
    fc.string({ unit: fc.constantFrom(...SAFE_VALUE_CHARS.split('')), maxLength: 40 }),
  )
  .map(([head, tail]) => (head + tail).trim())
  .filter((s) => s.length > 0 && !YAML_KEYWORDS.has(s.toLowerCase()));

// A valid 'YYYY-MM-DD' date string (day capped at 28 so every date is real).
const dateArb = fc
  .tuple(
    fc.integer({ min: 2000, max: 2099 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
  )
  .map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

interface EntryInput {
  type: (typeof CHANGELOG_TYPES)[number];
  date: string;
  title: string;
  version?: string;
  summary?: string;
  content: string;
  emitClosingFence: boolean;
}

const entryArb: fc.Arbitrary<EntryInput> = fc.record({
  type: fc.constantFrom(...CHANGELOG_TYPES),
  date: dateArb,
  title: safeValueArb,
  version: fc.option(safeValueArb, { nil: undefined }),
  summary: fc.option(safeValueArb, { nil: undefined }),
  // Body: zero or more lines, some of which may be bullet lines.
  content: fc
    .array(
      fc.oneof(
        fc.string({ unit: fc.constantFrom(...SAFE_VALUE_CHARS.split('')), maxLength: 40 }),
        fc
          .string({ unit: fc.constantFrom(...SAFE_VALUE_CHARS.split('')), maxLength: 40 })
          .map((s) => `- ${s}`),
      ),
      { maxLength: 5 },
    )
    .map((lines) => lines.join('\n')),
  // Entries may omit the closing --- fence (the parser must tolerate both).
  emitClosingFence: fc.boolean(),
});

function withUniqueTitles(entries: EntryInput[]): EntryInput[] {
  return entries.map((e, i) => ({ ...e, title: `${e.title} uid${i}` }));
}

function serializeEntry(e: EntryInput): string {
  // `date:` leads the frontmatter - the on-disk convention the parser uses to
  // detect entry boundaries.
  const fm: string[] = [`date: ${e.date}`];
  if (e.version !== undefined) fm.push(`version: ${e.version}`);
  fm.push(`type: ${e.type}`, `title: ${e.title}`);
  if (e.summary !== undefined) fm.push(`summary: ${e.summary}`);

  const parts = ['---', ...fm];
  if (e.emitClosingFence) parts.push('---');
  if (e.content.length > 0) parts.push(e.content);
  return parts.join('\n');
}

function serializeAll(entries: EntryInput[]): string {
  return entries.map(serializeEntry).join('\n');
}

// -- Properties -----------------------------------------------------------------

describe('parseChangelogSource - completeness and field round-trip', () => {
  it('returns exactly one entry per input with every field round-tripped', () => {
    fc.assert(
      fc.property(fc.array(entryArb, { minLength: 0, maxLength: 50 }), (rawEntries) => {
        const inputs = withUniqueTitles(rawEntries);
        const parsed: ChangelogEntry[] = parseChangelogSource(serializeAll(inputs));

        expect(parsed).toHaveLength(inputs.length);

        const byTitle = new Map(parsed.map((p) => [p.title, p]));
        for (const input of inputs) {
          const out = byTitle.get(input.title);
          expect(out, `missing entry for title ${JSON.stringify(input.title)}`).toBeDefined();
          expect(out!.date).toBe(input.date);
          expect(out!.type).toBe(input.type);
          if (input.version !== undefined) expect(out!.version).toBe(input.version);
          expect(out!.summary).toBe(input.summary ?? '');
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe('parseChangelogSource - newest-first ordering', () => {
  it('every adjacent pair is non-increasing by date (duplicates allowed)', () => {
    fc.assert(
      fc.property(fc.array(entryArb, { minLength: 0, maxLength: 30 }), (rawEntries) => {
        const parsed = parseChangelogSource(serializeAll(withUniqueTitles(rawEntries)));
        for (let i = 1; i < parsed.length; i++) {
          const prev = new Date(parsed[i - 1].date).getTime();
          const curr = new Date(parsed[i].date).getTime();
          expect(prev).toBeGreaterThanOrEqual(curr);
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe('parseChangelogSource - malformed entries', () => {
  it('skips a malformed block without dropping its siblings', () => {
    const source = [
      '---',
      'date: 2026-01-02',
      'type: Fix',
      'title: Good entry',
      '---',
      'body text',
      '---',
      'date: 2026-01-01',
      'type: NotARealType',
      'title: Bad entry',
      '---',
    ].join('\n');

    const parsed = parseChangelogSource(source);
    expect(parsed.map((e) => e.title)).toEqual(['Good entry']);
  });

  it('returns [] for empty input', () => {
    expect(parseChangelogSource('')).toEqual([]);
  });
});

// -- Regression against the real on-disk changelog -------------------------------
// Entries authored without a closing --- fence (the two 2026-05-18 entries) were
// silently dropped by a previous parser version; prove they still survive.

describe('getChangelog (real content/changelog files)', () => {
  it('returns entries dated after 2026-05-16 that a past parser dropped', async () => {
    const entries = await getChangelog();
    expect(entries.length).toBeGreaterThan(1);

    const cutoff = new Date('2026-05-16');
    expect(entries.some((e) => new Date(e.date) > cutoff)).toBe(true);

    const titles = entries.map((e) => e.title);
    expect(titles.some((t) => t.includes('AI-powered form fill via Cerebras'))).toBe(true);
  });

  it('returns entries newest-first', async () => {
    const entries = await getChangelog();
    for (let i = 1; i < entries.length; i++) {
      expect(new Date(entries[i - 1].date).getTime()).toBeGreaterThanOrEqual(
        new Date(entries[i].date).getTime(),
      );
    }
  });
});
