// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { formatContextForPrompt, type UserContext } from '@/lib/userContext';

// formatContextForPrompt is injected into every AI prompt, so the outcome
// section has to be honest about thin data rather than stating a coincidence
// as fact - and must never leak "undefined" into a prompt.

const base: UserContext = {
  fullName: 'Test User',
  skills: ['TypeScript'],
  targetRoles: ['Software Engineer'],
};

describe('formatContextForPrompt - outcome section', () => {
  it('says nothing has been decided when there is no outcome data', () => {
    const out = formatContextForPrompt(base);
    expect(out).toContain('WHAT HAS ACTUALLY WORKED FOR THIS CANDIDATE:');
    expect(out).toContain('No applications have reached a decision yet');
    expect(out).not.toContain('undefined');
  });

  it('tells the model not to draw conclusions below the confidence floor', () => {
    const out = formatContextForPrompt({
      ...base,
      outcomes: {
        decidedApplications: 4,
        linkedApplications: 2,
        overallResponseRate: 50,
        confident: false,
        signals: [],
      },
    });
    expect(out).toContain('too few to draw conclusions');
    expect(out).toContain('Do not claim to know what works');
  });

  it('reports the response rate without inventing a cause when no factor stands out', () => {
    const out = formatContextForPrompt({
      ...base,
      outcomes: {
        decidedApplications: 20,
        linkedApplications: 12,
        overallResponseRate: 15,
        confident: true,
        signals: [],
      },
    });
    expect(out).toContain('20 decided applications at a 15% response rate');
    expect(out).toContain('No single factor stands out yet');
  });

  it('states each signal with both sides of the comparison and its sample size', () => {
    const out = formatContextForPrompt({
      ...base,
      outcomes: {
        decidedApplications: 22,
        linkedApplications: 14,
        overallResponseRate: 27.3,
        confident: true,
        signals: [
          {
            factor: 'Applications sent with a tailored resume',
            respondedRate: 41.7,
            comparisonRate: 10,
            comparisonLabel: 'applications without one',
            sampleSize: 12,
          },
        ],
      },
    });
    expect(out).toContain('Based on 22 decided applications (27.3% overall response rate)');
    expect(out).toContain(
      'Applications sent with a tailored resume: 41.7% response rate vs 10% for applications without one (n=12)'
    );
    expect(out).not.toContain('undefined');
  });
});
