import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withTimeout } from '@/lib/withTimeout';

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the promise value when it settles before the deadline', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000, 'fast-op')).resolves.toBe('ok');
  });

  it('propagates the promise rejection when it fails before the deadline', async () => {
    const boom = new Error('boom');
    await expect(withTimeout(Promise.reject(boom), 1000, 'failing-op')).rejects.toBe(boom);
  });

  it('rejects with a labeled error naming the operation and duration after ms elapse', async () => {
    const never = new Promise<string>(() => {});
    const result = withTimeout(never, 30000, 'tailor-resume');
    const assertion = expect(result).rejects.toThrow(
      'Timed out after 30000ms while waiting for tailor-resume',
    );
    await vi.advanceTimersByTimeAsync(30000);
    await assertion;
  });

  it('uses the default label "operation" when none is given', async () => {
    const never = new Promise<string>(() => {});
    const result = withTimeout(never, 5000);
    const assertion = expect(result).rejects.toThrow(
      'Timed out after 5000ms while waiting for operation',
    );
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it('does not time out a promise that resolves exactly at the wire', async () => {
    let resolveIt!: (v: string) => void;
    const slow = new Promise<string>((res) => {
      resolveIt = res;
    });
    const result = withTimeout(slow, 1000, 'slow-op');

    await vi.advanceTimersByTimeAsync(999);
    resolveIt('made it');
    await expect(result).resolves.toBe('made it');
  });

  it('clears its timer once settled (no timer left pending)', async () => {
    await withTimeout(Promise.resolve(1), 60000, 'op');
    expect(vi.getTimerCount()).toBe(0);
  });
});
