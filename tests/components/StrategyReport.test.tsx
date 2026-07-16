import { describe, it, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import fc from 'fast-check';
import StrategyReport from '@/app/(dashboard)/strategy/StrategyReport';
import type { StrategyFeedback } from '@/app/api/strategy-feedback/route';
import { asArray } from '@/lib/asArray';

/**
 * StrategyReport fetches `/api/strategy-feedback` internally. Each property
 * run stubs global.fetch so the component renders a generated - potentially
 * malformed - feedback shape, then asserts the DOM never breaks: the asArray
 * guards must coerce garbage fields to empty sections, never throw.
 */

// A single array field: either a valid string[] or a malformed value.
const arrayFieldArb = fc.oneof(
  fc.array(fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0)),
  fc.constant(null),
  fc.constant(undefined),
  fc.integer(),
  fc.string(),
  fc.object(),
);

// ats_insight is rendered with `?? ''`; feed garbage too.
const atsInsightArb = fc.oneof(fc.string(), fc.constant(undefined), fc.integer());

const feedbackArb = fc.record({
  top_insights: arrayFieldArb,
  focus_roles: arrayFieldArb,
  avoid_roles: arrayFieldArb,
  top_suggestions: arrayFieldArb,
  skill_gaps_to_fix: arrayFieldArb,
  ats_insight: atsInsightArb,
});

function stubFetchWith(feedback: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        feedback,
        generatedAt: new Date().toISOString(),
      }),
    })),
  );
}

function countInSection(title: string, selector: string): number {
  const section = screen.getByText(title).closest('section');
  if (!section) throw new Error(`section for "${title}" not found`);
  return section.querySelectorAll(selector).length;
}

describe('StrategyReport - safe render for any feedback shape', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders without throwing and shows exactly asArray(field).length items per section', async () => {
    await fc.assert(
      fc.asyncProperty(feedbackArb, async (raw) => {
        // Start each run from a pristine DOM even if the previous run threw.
        cleanup();
        vi.unstubAllGlobals();

        // The declared type is strict; the guard exists for runtime garbage.
        stubFetchWith(raw as unknown as StrategyFeedback);

        render(<StrategyReport />);
        await screen.findByText('Key Insights');

        const expectedInsights = asArray<string>(raw.top_insights).length;
        const expectedFocus = asArray<string>(raw.focus_roles).length;
        const expectedAvoid = asArray<string>(raw.avoid_roles).length;
        const expectedSuggestions = asArray<string>(raw.top_suggestions).length;
        const expectedSkills = asArray<string>(raw.skill_gaps_to_fix).length;

        // Key Insights: grid cards === asArray(top_insights).length
        const insightsSection = screen.getByText('Key Insights').closest('section')!;
        const grid = insightsSection.children[1];
        if (grid.children.length !== expectedInsights) {
          throw new Error(
            `Key Insights rendered ${grid.children.length}, expected ${expectedInsights}`,
          );
        }

        const suggestionItems = countInSection('Next steps', 'ol li');
        if (suggestionItems !== expectedSuggestions) {
          throw new Error(`Next steps rendered ${suggestionItems}, expected ${expectedSuggestions}`);
        }

        const focusSpans = countInSection('Focus here', 'span');
        if (focusSpans !== expectedFocus) {
          throw new Error(`Focus here rendered ${focusSpans}, expected ${expectedFocus}`);
        }
        if (expectedFocus === 0) {
          await screen.findByText('No clear standout roles yet.');
        }

        const avoidSpans = countInSection('Stop applying here', 'span');
        if (avoidSpans !== expectedAvoid) {
          throw new Error(`Stop applying here rendered ${avoidSpans}, expected ${expectedAvoid}`);
        }
        if (expectedAvoid === 0) {
          await screen.findByText('No roles to avoid identified yet.');
        }

        const skillSpans = countInSection('Skills to add to your profile', 'span');
        if (skillSpans !== expectedSkills) {
          throw new Error(`Skills rendered ${skillSpans}, expected ${expectedSkills}`);
        }
        if (expectedSkills === 0) {
          await screen.findByText('No specific skill gaps identified.');
        }

        // Every real item's text must actually render. Testing Library
        // collapses whitespace, so normalize the expected value the same way.
        const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
        for (const insight of asArray<string>(raw.top_insights)) {
          if (screen.queryAllByText(norm(insight)).length === 0) {
            throw new Error(`insight text not rendered: ${JSON.stringify(insight)}`);
          }
        }
        for (const role of asArray<string>(raw.focus_roles)) {
          if (screen.queryAllByText(norm(role)).length === 0) {
            throw new Error(`focus role text not rendered: ${JSON.stringify(role)}`);
          }
        }

        cleanup();
        vi.unstubAllGlobals();
      }),
      { numRuns: 100 },
    );
    // 100 full React renders with async fetch far exceed the default 5s budget.
  }, 60000);
});
