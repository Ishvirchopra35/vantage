// Returns the caller's remaining monthly feature quotas for the sidebar/UI.
import { requireAuth } from '@/lib/requireAuth';
import { ok } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { getRemainingLimits } from '@/lib/rateLimit';

export async function GET(_request: Request): Promise<Response> {
  const start = Date.now();

  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const limits = await getRemainingLimits(user.id);

  await logRoute('/api/remaining-uses', user.id, Date.now() - start, 200);

  const response = ok({ limits });
  response.headers.set('Cache-Control', 'private, max-age=60');
  return response;
}
