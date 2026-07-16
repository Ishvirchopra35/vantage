// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Sentry from '@sentry/nextjs';
import {
  ok,
  err,
  unauthorized,
  notFound,
  forbidden,
  rateLimited,
  serverError,
} from '@/lib/apiResponse';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

describe('apiResponse helpers', () => {
  it('ok() returns 200 with the JSON payload', async () => {
    const res = ok({ result: 'done' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: 'done' });
  });

  it('ok() honors a custom status', () => {
    expect(ok({ created: true }, 201).status).toBe(201);
  });

  it('err() returns the given status with { error } so clients can always rely on it', async () => {
    const res = err('bad input', 400);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad input' });
  });

  it('unauthorized() is a 401 with { error: "Unauthorized" }', async () => {
    const res = unauthorized();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('notFound() is a 404 naming the resource', async () => {
    const res = notFound('Job');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Job not found' });
  });

  it('forbidden() is a 403 with the reason', async () => {
    const res = forbidden('admin only');
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden: admin only' });
  });

  it('rateLimited() is a 429 naming feature, limit, and reset window', async () => {
    const res = rateLimited('resume tailoring', 10, 30);
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('resume tailoring');
    expect(body.error).toContain('10');
    expect(body.error).toContain('30');
  });
});

describe('serverError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('returns a generic 500 without leaking internal details', async () => {
    const res = serverError(new Error('secret database string'));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Something went wrong on our end. Please try again.');
    expect(JSON.stringify(body)).not.toContain('secret database string');
  });

  it('reports the original exception to Sentry (routes catch their own errors, so this is the only capture point)', () => {
    const boom = new Error('boom');
    serverError(boom);
    expect(Sentry.captureException).toHaveBeenCalledWith(boom);
  });
});
