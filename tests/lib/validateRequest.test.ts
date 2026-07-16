import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateBody } from '@/lib/validateRequest';

interface JobBody extends Record<string, unknown> {
  jobId: string;
}

describe('validateBody', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'body'],
    ['a number', 5],
    ['an array', ['jobId']],
  ])('rejects %s with the JSON-object error', (_label, body) => {
    const result = validateBody<JobBody>(body, ['jobId']);
    expect(result).toEqual({ valid: false, error: 'Request body must be a JSON object' });
  });

  it('rejects a missing required key, naming the key', () => {
    const result = validateBody<JobBody>({}, ['jobId']);
    expect(result).toEqual({ valid: false, error: 'Missing required field: jobId' });
  });

  it('rejects null values for required keys (null is treated as missing)', () => {
    const result = validateBody<JobBody>({ jobId: null }, ['jobId']);
    expect(result).toEqual({ valid: false, error: 'Missing required field: jobId' });
  });

  it('accepts a body with all required keys and returns it typed', () => {
    const body = { jobId: 'abc', extra: 1 };
    const result = validateBody<JobBody>(body, ['jobId']);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data).toBe(body);
      expect(result.data.jobId).toBe('abc');
    }
  });

  it('accepts falsy-but-present values ("", 0, false) - only null/undefined are missing', () => {
    const result = validateBody({ a: '', b: 0, c: false }, ['a', 'b', 'c']);
    expect(result.valid).toBe(true);
  });

  it('reports the first missing key in required-list order', () => {
    const result = validateBody({ b: 1 }, ['a', 'b', 'c']);
    expect(result).toEqual({ valid: false, error: 'Missing required field: a' });
  });

  it('accepts any object when no keys are required', () => {
    expect(validateBody({}, []).valid).toBe(true);
  });

  it('property: valid iff body is a non-array object containing every required key non-null', () => {
    const keyArb = fc.constantFrom('a', 'b', 'c');
    fc.assert(
      fc.property(
        fc.oneof(
          fc.dictionary(keyArb, fc.oneof(fc.string(), fc.integer(), fc.constant(null))),
          fc.anything(),
        ),
        fc.uniqueArray(keyArb, { maxLength: 3 }),
        (body, required) => {
          const result = validateBody(body, required);
          const isObject = Boolean(body) && typeof body === 'object' && !Array.isArray(body);
          const allPresent =
            isObject &&
            required.every((k) => {
              const v = (body as Record<string, unknown>)[k];
              return v !== undefined && v !== null;
            });
          expect(result.valid).toBe(allPresent);
        },
      ),
      { numRuns: 200 },
    );
  });
});
