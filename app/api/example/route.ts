// Reference implementation of the required API route pattern (auth ->
// validate -> limits -> withTimeout -> charge on success -> logRoute).
// Copy this when adding routes; it is a live endpoint but nothing in the
// app calls it, so it deliberately makes NO AI call - the placeholder
// below marks where generateText/generateJSON from '@/lib/ai' would go.
import { NextRequest } from 'next/server';
import { ok, err, serverError, rateLimited } from '@/lib/apiResponse';
import { validateBody } from '@/lib/validateRequest';
import requireAuth from '@/lib/requireAuth';
import { withTimeout } from '@/lib/withTimeout';
import logRoute from '@/lib/logger';
import { checkLimit, consumeLimit, LIMITS, checkRateLimit, rateLimitResponse, recordRateLimitUse } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const userId = auth.user?.id ?? null;

    const body = await req.json().catch(() => null);

    const validated = validateBody<{ prompt: string }>(body, ['prompt']);
    if (!validated.valid) return err(validated.error, 400);

    if (userId) {
      const limitCheck = await checkLimit(userId, 'tailoring');
      if (!limitCheck.allowed) {
        await logRoute('/api/example', userId, Date.now() - start, 429).catch(() => {});
        return rateLimited('AI usage', LIMITS.tailoring, 30);
      }

      const rateLimit = await checkRateLimit({
        key: 'example',
        userId,
        devLimit: 5,
        freeLimit: 10,
        proLimit: 10,
        devWindowMinutes: 1440,
        freeWindowMinutes: 43200,
        proWindowMinutes: 1440,
      });
      if (!rateLimit.allowed) {
        await logRoute('/api/example', userId, Date.now() - start, 429).catch(() => {});
        return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining, rateLimit.tier);
      }
    }

    // Business logic goes here, wrapped in withTimeout. A real AI route would
    // call generateText/generateJSON from '@/lib/ai' at this point; this
    // template endpoint just echoes to avoid spending tokens on a route
    // nothing calls.
    const text = await withTimeout(
      Promise.resolve(`Echo: ${validated.data.prompt}`),
      30000,
      'example'
    );

    const duration = Date.now() - start;
    // Charge the limits only on success - checkLimit/checkRateLimit are
    // read-only, so failed requests never burn a use.
    if (userId) {
      await Promise.all([
        consumeLimit(userId, 'tailoring'),
        recordRateLimitUse('example', userId),
      ]);
    }
    // Log route (fire-and-forget)
    logRoute('/api/example', userId, duration, 200).catch(() => {});

    return ok({ text });
  } catch (e) {
    const duration = Date.now() - start;
    logRoute('/api/example', null, duration, 500).catch(() => {});
    return serverError(e);
  }
}

export const runtime = 'edge';
