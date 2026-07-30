// Stores how far through the walkthrough someone got.
//
// DELIBERATELY OUTSIDE THE LIMIT SYSTEM. There is no checkLimit, no
// consumeLimit and no recordRateLimitUse anywhere in this file, and there must
// never be: the walkthrough is help, and charging someone a monthly use for
// reading an explanation would be indefensible. It also runs on a brand-new
// account, where spending a use before they have produced anything would be
// the first thing the product ever did.
//
// It is safe to leave ungated because it does no work worth abusing: one small
// write of a bounded shape to the caller's own profile row. There is no AI
// call, no third-party request and nothing that costs money per invocation.

import { requireAuth } from '@/lib/requireAuth';
import { createClient } from '@/lib/supabase/server';
import { ok, err, serverError } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { readOnboarding, TOUR_LENGTH, type OnboardingState } from '@/lib/onboarding';

const ROUTE = '/api/onboarding';

/**
 * The caller's own walkthrough state.
 *
 * Same reasoning as POST: no limits, no AI, one small read of the caller's own
 * row. Exists because "why is the walkthrough not running" is otherwise
 * unanswerable from the browser - the state only ever reached the client as a
 * prop, so a stale or unexpected row looked identical to a broken component.
 */
export async function GET(): Promise<Response> {
  const start = Date.now();

  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      await logRoute(ROUTE, user.id, Date.now() - start, 500);
      return serverError(new Error(error.message));
    }

    await logRoute(ROUTE, user.id, Date.now() - start, 200);
    return ok({ onboarding: readOnboarding(data?.onboarding), raw: data?.onboarding ?? null });
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500);
    return serverError(e);
  }
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now();

  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err('Invalid request body', 400);
  }

  const input = (body ?? {}) as Record<string, unknown>;

  // Built here rather than taken from the request, so the column can only ever
  // hold this shape however the caller is written or misbehaves.
  const state: OnboardingState = readOnboarding({
    step: input.step,
    completed: input.completed,
    skipped: input.skipped,
    seenAt: new Date().toISOString(),
  });

  if (typeof input.step === 'number' && (input.step < 0 || input.step >= TOUR_LENGTH + 1)) {
    return err('Step out of range', 400);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding: state })
      .eq('id', user.id);

    if (error) {
      await logRoute(ROUTE, user.id, Date.now() - start, 500);
      return serverError(new Error(error.message));
    }

    await logRoute(ROUTE, user.id, Date.now() - start, 200);
    return ok({ onboarding: state });
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500);
    return serverError(e);
  }
}
