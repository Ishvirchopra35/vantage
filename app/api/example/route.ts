// Reference implementation of the required API route pattern (auth ->
// validate -> limits -> withTimeout -> logRoute). Copy this when adding
// routes; it is a live endpoint but nothing in the app calls it.
import { NextRequest } from 'next/server';
import { ok, err, serverError, rateLimited } from '@/lib/apiResponse';
import { validateBody } from '@/lib/validateRequest';
import requireAuth from '@/lib/requireAuth';
import { withTimeout } from '@/lib/withTimeout';
import logRoute from '@/lib/logger';
import { checkLimit, LIMITS, checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';
import { generateText } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const userId = auth.user?.id ?? null;

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

    const body = await req.json().catch(() => null);

    const validated = validateBody<{ prompt: string }>(body, ['prompt']);
    if (!validated.valid) return err(validated.error, 400);

    // Call AI with a timeout of 30s
    const text = await withTimeout(
      generateText('You are a helpful assistant.', validated.data.prompt, 800),
      30000,
      'AI'
    );

    // Example of a Supabase operation wrapped with timeout (5000ms) - omitted actual call

    const duration = Date.now() - start;
    // Log route (fire-and-forget)
    logRoute('/api/example', userId, duration, 200).catch(() => {});

    return ok({ text });
  } catch (e) {
    const duration = Date.now() - start;
    // Attempt to log server error
    logRoute('/api/example', null, duration, 500).catch(() => {});
    return serverError(e);
  }
}

export const runtime = 'edge';
