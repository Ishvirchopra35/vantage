// Exposes the outcome analysis (what actually correlates with getting a
// response) to the tracker UI. Read-only, no AI call, so no limit check.
import { requireAuth } from '@/lib/requireAuth';
import { ok, serverError } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { analyzeOutcomes, MIN_DECIDED_FOR_INSIGHTS } from '@/lib/outcomes';

export async function GET(): Promise<Response> {
  const start = Date.now();

  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  try {
    const outcomes = await analyzeOutcomes(user.id);
    await logRoute('/api/outcomes', user.id, Date.now() - start, 200);
    return ok({ outcomes, threshold: MIN_DECIDED_FOR_INSIGHTS });
  } catch (e) {
    await logRoute('/api/outcomes', user.id, Date.now() - start, 500);
    return serverError(e);
  }
}
