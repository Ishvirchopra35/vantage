// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';

// lib/rateLimit reads ENABLE_FREEMIUM at import time, so each scenario stubs
// the env and re-imports a fresh module instance. No Supabase env vars are
// set anywhere in this file - every code path exercised here must short-
// circuit BEFORE touching the database (that is exactly what these tests
// prove; a regression that adds a DB call will throw on missing credentials).
async function loadRateLimit(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  return import('@/lib/rateLimit');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('LIMITS - the free-tier pricing contract', () => {
  it('matches the published free-tier quotas', async () => {
    const { LIMITS } = await loadRateLimit({ ENABLE_FREEMIUM: 'false' });
    expect(LIMITS).toEqual({
      tailoring: 10,
      cover_letter: 10,
      auto_apply: 20,
      applications: 150,
      strategy_feedback: 2,
      networking: 15,
      interview: 5,
    });
  });
});

describe('RATE_LIMIT_SPECS - /limits page mirror', () => {
  it('has unique keys, non-empty labels, and positive limits for every tier', async () => {
    const { RATE_LIMIT_SPECS } = await loadRateLimit({ ENABLE_FREEMIUM: 'false' });
    const keys = RATE_LIMIT_SPECS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const spec of RATE_LIMIT_SPECS) {
      expect(spec.label.length).toBeGreaterThan(0);
      expect(spec.devLimit).toBeGreaterThan(0);
      expect(spec.freeLimit).toBeGreaterThan(0);
      expect(spec.proLimit).toBeGreaterThan(0);
    }
  });
});

describe('dev mode (ENABLE_FREEMIUM=false) - everything short-circuits to unlimited', () => {
  it('checkLimit allows immediately with no database access', async () => {
    const { checkLimit } = await loadRateLimit({ ENABLE_FREEMIUM: 'false' });
    await expect(checkLimit('any-user', 'tailoring')).resolves.toEqual({
      allowed: true,
      remaining: 999,
      resetDate: null,
    });
  });

  it('consumeLimit is a no-op', async () => {
    const { consumeLimit } = await loadRateLimit({ ENABLE_FREEMIUM: 'false' });
    await expect(consumeLimit('any-user', 'tailoring')).resolves.toBeUndefined();
  });

  it('getRemainingLimits reports 999 for every feature', async () => {
    const { getRemainingLimits, LIMITS } = await loadRateLimit({ ENABLE_FREEMIUM: 'false' });
    const remaining = await getRemainingLimits('any-user');
    for (const key of Object.keys(LIMITS)) {
      expect(remaining[key]).toBe(999);
    }
  });

  it('resolveUserTier reports dev', async () => {
    const { resolveUserTier } = await loadRateLimit({ ENABLE_FREEMIUM: 'false' });
    await expect(resolveUserTier('any-user')).resolves.toBe('dev');
  });
});

describe('admin bypass (ENABLE_FREEMIUM=true, ADMIN_USER_ID set)', () => {
  const env = { ENABLE_FREEMIUM: 'true', ADMIN_USER_ID: 'admin-user-id' };

  it('checkLimit always allows the admin without touching the database', async () => {
    const { checkLimit } = await loadRateLimit(env);
    await expect(checkLimit('admin-user-id', 'tailoring')).resolves.toEqual({
      allowed: true,
      remaining: 999,
      resetDate: null,
    });
  });

  it('checkRateLimit always allows the admin at full remaining', async () => {
    const { checkRateLimit } = await loadRateLimit(env);
    const result = await checkRateLimit({
      key: 'tailor-resume',
      userId: 'admin-user-id',
      devLimit: 1,
      freeLimit: 10,
      proLimit: 5,
      devWindowMinutes: 1440,
      freeWindowMinutes: 43200,
      proWindowMinutes: 1440,
    });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
    expect(result.tier).toBe('dev');
  });

  it('recordRateLimitUse never logs the admin', async () => {
    const { recordRateLimitUse } = await loadRateLimit(env);
    // Would throw on missing Supabase credentials if it tried to insert.
    await expect(recordRateLimitUse('tailor-resume', 'admin-user-id')).resolves.toBeUndefined();
  });
});

describe('rateLimitResponse', () => {
  it('is a 429 whose body carries resetAt, retryAfter, and remaining', async () => {
    const { rateLimitResponse } = await loadRateLimit({ ENABLE_FREEMIUM: 'false' });
    const resetAt = new Date(Date.now() + 60_000);
    const res = rateLimitResponse(resetAt, 0, 'dev');
    expect(res.status).toBe(429);
    const body = (await res.json()) as {
      error: string;
      resetAt: string;
      retryAfter: number;
      remaining: number;
    };
    expect(body.resetAt).toBe(resetAt.toISOString());
    expect(body.retryAfter).toBeGreaterThanOrEqual(0);
    expect(body.retryAfter).toBeLessThanOrEqual(60);
    expect(body.remaining).toBe(0);
  });

  it('mentions upgrading only on the free (monthly) tier', async () => {
    const { rateLimitResponse } = await loadRateLimit({ ENABLE_FREEMIUM: 'false' });
    const resetAt = new Date(Date.now() + 60_000);

    const freeBody = (await rateLimitResponse(resetAt, 0, 'free').json()) as { error: string };
    expect(freeBody.error).toContain('Upgrade to Pro');

    for (const tier of ['dev', 'pro'] as const) {
      const body = (await rateLimitResponse(resetAt, 0, tier).json()) as { error: string };
      expect(body.error).toContain('Try again tomorrow');
      expect(body.error).not.toContain('Upgrade');
    }
  });
});
