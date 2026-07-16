import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { asArray } from '@/lib/asArray';

describe('asArray', () => {
  it('returns an empty array unchanged (same reference)', () => {
    const input: number[] = [];
    const result = asArray<number>(input);
    expect(result).toEqual([]);
    expect(result).toBe(input);
  });

  it('returns a populated array unchanged (same reference)', () => {
    const input = [1, 2];
    const result = asArray<number>(input);
    expect(result).toEqual([1, 2]);
    expect(result).toBe(input);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a number', 42],
    ['a string', 'x'],
    ['a plain object', {}],
    ['a boolean', true],
  ])('returns [] for %s', (_label, value) => {
    expect(asArray(value)).toEqual([]);
  });

  it('property: output is always an array, and arrays always pass through by reference', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        const result = asArray(value);
        expect(Array.isArray(result)).toBe(true);
        if (Array.isArray(value)) {
          expect(result).toBe(value);
        } else {
          expect(result).toEqual([]);
        }
      }),
      { numRuns: 200 },
    );
  });
});
