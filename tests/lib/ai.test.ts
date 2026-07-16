// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Sentry from '@sentry/nextjs';
import { checkSharedQuota } from '@/lib/rateLimit';
import { generateText, generateJSON, isAiQuotaError, AI_BUSY_MESSAGE } from '@/lib/ai';

// lib/ai.ts is the single Gemini gateway; these tests mock the SDK and the
// shared-quota bookkeeping so no network or database is touched.
const mocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: mocks.generateContent };
    }
  },
}));

vi.mock('@/lib/rateLimit', () => ({
  checkSharedQuota: vi.fn(),
  incrementSharedQuota: vi.fn(async () => {}),
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
}));

const checkSharedQuotaMock = vi.mocked(checkSharedQuota);

function quotaState(used: number, max = 4500) {
  return { allowed: used < max, used, max, daysUntilReset: 30 };
}

function geminiReply(text: string) {
  return { response: { text: () => text } };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  checkSharedQuotaMock.mockResolvedValue(quotaState(0));
});

describe('generateText', () => {
  it('returns the model text on success and counts the call against the platform budget', async () => {
    mocks.generateContent.mockResolvedValue(geminiReply('hello from gemini'));
    await expect(generateText('system', 'user')).resolves.toBe('hello from gemini');
    const { incrementSharedQuota } = await import('@/lib/rateLimit');
    expect(incrementSharedQuota).toHaveBeenCalledWith('gemini_monthly');
  });

  it('rejects with a quota-flavored error (never calling Gemini) when the platform budget is exhausted', async () => {
    checkSharedQuotaMock.mockResolvedValue(quotaState(4500));

    const promise = generateText('system', 'user');
    await expect(promise).rejects.toThrow(/quota/i);
    expect(mocks.generateContent).not.toHaveBeenCalled();

    // The thrown error must route to the friendly 429 path in routes.
    await promise.catch((e: unknown) => expect(isAiQuotaError(e)).toBe(true));

    // Exhaustion is invisible to serverError(), so ai.ts must report it itself.
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('exhausted'),
      'error',
    );
  });

  it('emits a Sentry warning when usage crosses 80% of the budget but still serves the call', async () => {
    checkSharedQuotaMock.mockResolvedValue(quotaState(3600)); // exactly 80%
    mocks.generateContent.mockResolvedValue(geminiReply('still working'));

    await expect(generateText('system', 'user')).resolves.toBe('still working');
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('80%'),
      'warning',
    );
  });

  it('does not warn below the 80% threshold', async () => {
    checkSharedQuotaMock.mockResolvedValue(quotaState(3599));
    mocks.generateContent.mockResolvedValue(geminiReply('ok'));

    await generateText('system', 'user');
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('rejects when the model returns an empty response', async () => {
    mocks.generateContent.mockResolvedValue(geminiReply('   '));
    await expect(generateText('system', 'user')).rejects.toThrow(/Empty response from Gemini/);
  });
});

describe('generateJSON', () => {
  it('parses a clean JSON object', async () => {
    mocks.generateContent.mockResolvedValue(geminiReply('{"title":"SWE","score":92}'));
    await expect(generateJSON('system', 'user')).resolves.toEqual({ title: 'SWE', score: 92 });
  });

  it('strips markdown code fences the model was told not to emit (but sometimes does)', async () => {
    mocks.generateContent.mockResolvedValue(geminiReply('```json\n{"a":1}\n```'));
    await expect(generateJSON('system', 'user')).resolves.toEqual({ a: 1 });
  });

  it('extracts JSON embedded in surrounding prose', async () => {
    mocks.generateContent.mockResolvedValue(
      geminiReply('Here is the result: {"skills":["ts"]} hope that helps!'),
    );
    await expect(generateJSON('system', 'user')).resolves.toEqual({ skills: ['ts'] });
  });

  it('parses a top-level JSON array', async () => {
    mocks.generateContent.mockResolvedValue(geminiReply('[1,2,3]'));
    await expect(generateJSON('system', 'user')).resolves.toEqual([1, 2, 3]);
  });

  it('rejects with a stable message when no JSON can be parsed', async () => {
    mocks.generateContent.mockResolvedValue(geminiReply('I cannot answer that.'));
    await expect(generateJSON('system', 'user')).rejects.toThrow(
      'Failed to parse JSON from AI response.',
    );
  });
});

describe('isAiQuotaError', () => {
  it.each([
    ['429 status text', new Error('Request failed with status 429')],
    ['quota wording', new Error('Platform AI quota exhausted for this period')],
    ['rate limit wording', new Error('rate limit exceeded')],
    ['resource exhausted', new Error('RESOURCE_EXHAUSTED')],
    ['high demand (503)', new Error('model is experiencing high demand')],
  ])('recognizes %s as a capacity error', (_label, error) => {
    expect(isAiQuotaError(error)).toBe(true);
  });

  it('does not flag unrelated errors', () => {
    expect(isAiQuotaError(new Error('column does not exist'))).toBe(false);
  });

  it('AI_BUSY_MESSAGE is user-friendly copy, not an internal error', () => {
    expect(AI_BUSY_MESSAGE).toMatch(/try again/i);
  });
});
