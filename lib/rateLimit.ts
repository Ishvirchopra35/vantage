import { createClient as createServiceClient } from '@supabase/supabase-js';

const ENABLE_FREEMIUM = String(process.env.ENABLE_FREEMIUM ?? 'true');

// Monthly limits for free tier
export const LIMITS = {
  tailoring: 10,
  cover_letter: 10,
  auto_apply: 20,
  applications: 150, // total cap, not monthly
  strategy_feedback: 2,
  networking: 15,
  interview: 5,
} as const;

export const FREE_LIMITS = LIMITS;

type Feature = keyof typeof LIMITS;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase service credentials');
  return createServiceClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

async function ensureSubscriptionRow(svc: any, userId: string) {
  try {
    const { data } = await svc.from('subscriptions').select('*').eq('user_id', userId).limit(1).single();
    if (data) return data;
  } catch {
    // Row doesn't exist yet, continue to create it
  }

  try {
    const insert = {
      user_id: userId,
      plan: 'free',
    };
    const { data: created } = await svc.from('subscriptions').insert(insert).select().single();
    return created;
  } catch {
    return null;
  }
}

function daysBetween(a: string | Date, b: Date) {
  const da = new Date(a).getTime();
  const db = b.getTime();
  return (db - da) / (1000 * 60 * 60 * 24);
}

async function resetMonthlyIfNeeded(svc: any, subRow: any) {
  if (!subRow) return;
  const monthlyReset = subRow.monthly_reset_at ? new Date(subRow.monthly_reset_at) : new Date(0);
  const now = new Date();
  if (daysBetween(monthlyReset, now) >= 30) {
    try {
      await svc
        .from('subscriptions')
        .update({
          tailoring_uses: 0,
          cover_letter_uses: 0,
          auto_apply_uses: 0,
          strategy_uses: 0,
          networking_uses: 0,
          interview_uses: 0,
          monthly_reset_at: now.toISOString(),
        })
        .eq('user_id', subRow.user_id);
    } catch {
      // Fail silently
    }
  }
}

async function incrementCounterAtomic(svc: any, userId: string, column: string, limit: number) {
  // Attempt read and conditional update with optimistic locking (retry few times)
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { data } = await svc.from('subscriptions').select(column).eq('user_id', userId).limit(1).single();
      const current = data ? Number(data[column]) || 0 : 0;
      if (current >= limit) return { success: false, remaining: 0 };

      const { data: updated } = await svc
        .from('subscriptions')
        .update({ [column]: current + 1 })
        .eq('user_id', userId)
        .eq(column, current)
        .select();

      if (updated && updated.length) {
        return { success: true, remaining: Math.max(0, limit - (current + 1)) };
      }
    } catch {
      // Race condition or error, retry
    }
  }
  return { success: false, remaining: 0 };
}

export async function checkLimit(userId: string, feature: Feature): Promise<{ allowed: boolean; remaining: number; resetDate: Date | null }> {
  // Dev/testing override
  if (ENABLE_FREEMIUM === 'false') {
    return { allowed: true, remaining: 999, resetDate: null };
  }

  const svc = serviceClient();

  // Ensure subscription row exists
  const subRow = await ensureSubscriptionRow(svc, userId);

  // Reset monthly counters if needed
  await resetMonthlyIfNeeded(svc, subRow);

  const plan = subRow?.plan ?? 'free';
  if (plan === 'pro') return { allowed: true, remaining: 999, resetDate: null };

  if (feature === 'applications') {
    // Count total non-deleted applications
    try {
      const { count } = await svc.from('applications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('deleted', false);
      const used = typeof count === 'number' ? count : 0;
      const cap = LIMITS.applications;
      const remaining = Math.max(0, cap - used);
      return { allowed: used < cap, remaining, resetDate: null };
    } catch {
      return { allowed: true, remaining: LIMITS.applications, resetDate: null };
    }
  }

  // Map features to subscription columns
  const map: Record<Feature, string> = {
    tailoring: 'tailoring_uses',
    cover_letter: 'cover_letter_uses',
    auto_apply: 'auto_apply_uses',
    applications: 'applications',
    strategy_feedback: 'strategy_uses',
    networking: 'networking_uses',
    interview: 'interview_uses',
  } as const;

  const column = map[feature];
  const limit = LIMITS[feature];

  // Atomically increment the counter (best-effort optimistic locking)
  const result = await incrementCounterAtomic(svc, userId, column, limit);
  return { allowed: result.success, remaining: result.remaining, resetDate: subRow?.monthly_reset_at ? new Date(subRow.monthly_reset_at) : null };
}

export async function getRemainingLimits(userId: string): Promise<Record<string, number>> {
  if (ENABLE_FREEMIUM === 'false') {
    const all: Record<string, number> = {};
    for (const k of Object.keys(LIMITS)) all[k] = 999;
    return all;
  }

  const svc = serviceClient();
  const subRow = await ensureSubscriptionRow(svc, userId);
  await resetMonthlyIfNeeded(svc, subRow);

  const countsRow = subRow || {};
  const out: Record<string, number> = {};
  for (const key of Object.keys(LIMITS) as Feature[]) {
    if (key === 'applications') {
      try {
        const { count } = await svc.from('applications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('deleted', false);
        const used = typeof count === 'number' ? count : 0;
        out[key] = Math.max(0, LIMITS.applications - used);
      } catch {
        out[key] = LIMITS.applications;
      }
    } else {
      const col = {
        tailoring: 'tailoring_uses',
        cover_letter: 'cover_letter_uses',
        auto_apply: 'auto_apply_uses',
        strategy_feedback: 'strategy_uses',
        networking: 'networking_uses',
        interview: 'interview_uses',
        applications: 'applications',
      }[key];
      const used = Number(countsRow[col]) || 0;
      out[key] = Math.max(0, LIMITS[key] - used);
    }
  }

  return out;
}

export default { checkLimit, getRemainingLimits, LIMITS };
