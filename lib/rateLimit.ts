// SERVER-SIDE ONLY - both layers of usage limiting:
//   1. checkLimit(): monthly feature quotas (subscriptions counters), the
//      freemium gate. ENABLE_FREEMIUM=false short-circuits to unlimited.
//   2. checkRateLimit(): sliding-window per-route limits (rate_limit_logs),
//      applied even in dev to keep AI spend bounded.
// Both checks are READ-ONLY: a request is charged only when the route calls
// consumeLimit() / recordRateLimitUse() on its success path. Failed requests
// (AI errors, timeouts, DB failures, bad input) never burn a use.
// RATE_LIMIT_SPECS mirrors every route's numbers for the /limits page - keep
// it in sync when a route's limits change.
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

// The admin account bypasses all per-user limits so the app can be tested freely.
function isAdminUser(userId: string): boolean {
  const adminId = process.env.ADMIN_USER_ID;
  return Boolean(adminId) && userId === adminId;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
type ServiceClient = any;

// One client per server instance - checkLimit/checkRateLimit run on every
// API request, and constructing a fresh client each call wastes work.
let cachedServiceClient: any = null;

function serviceClient(): any {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase service credentials');
  if (!cachedServiceClient) {
    cachedServiceClient = createServiceClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  }
  return cachedServiceClient;
}

async function ensureSubscriptionRow(svc: ServiceClient, userId: string) {
  try {
    const { data } = await svc
      .from('subscriptions')
      .select('user_id, plan, status, monthly_reset_at, tailoring_uses, cover_letter_uses, auto_apply_uses, strategy_uses, networking_uses, interview_uses')
      .eq('user_id', userId)
      .limit(1)
      .single();
    if (data) return data;
  } catch {
    // Row doesn't exist yet, continue to create it
  }

  try {
    const insert = {
      user_id: userId,
      plan: 'free',
    };
    const { data: created } = await (svc.from('subscriptions') as any).insert(insert).select().single();
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

async function resetMonthlyIfNeeded(
  svc: ServiceClient,
  subRow: { monthly_reset_at?: string | null; user_id?: string | null } | null
) {
  if (!subRow) return;
  const monthlyReset = subRow.monthly_reset_at ? new Date(subRow.monthly_reset_at) : new Date(0);
  const now = new Date();
  if (daysBetween(monthlyReset, now) >= 30) {
    try {
      await (svc.from('subscriptions') as any)
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

// Map features to subscription columns
const FEATURE_COLUMNS: Record<Feature, string> = {
  tailoring: 'tailoring_uses',
  cover_letter: 'cover_letter_uses',
  auto_apply: 'auto_apply_uses',
  applications: 'applications',
  strategy_feedback: 'strategy_uses',
  networking: 'networking_uses',
  interview: 'interview_uses',
} as const;

export async function checkLimit(userId: string, feature: Feature): Promise<{ allowed: boolean; remaining: number; resetDate: Date | null }> {
  // Dev/testing override
  if (ENABLE_FREEMIUM === 'false' || isAdminUser(userId)) {
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
      const { count } = await svc.from('applications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null);
      const used = typeof count === 'number' ? count : 0;
      const cap = LIMITS.applications;
      const remaining = Math.max(0, cap - used);
      return { allowed: used < cap, remaining, resetDate: null };
    } catch {
      return { allowed: true, remaining: LIMITS.applications, resetDate: null };
    }
  }

  const column = FEATURE_COLUMNS[feature];
  const limit = LIMITS[feature];

  // Read-only: the counter moves in consumeLimit(), which routes call only
  // after the feature actually delivered its result. A fresh read is needed
  // here because resetMonthlyIfNeeded may have just zeroed the counters.
  let used = 0;
  try {
    const { data } = await svc.from('subscriptions').select(column).eq('user_id', userId).limit(1).single();
    used = data ? Number((data as Record<string, unknown>)[column]) || 0 : 0;
  } catch {
    // Fail open - don't block on a read error
  }

  return {
    allowed: used < limit,
    remaining: Math.max(0, limit - used),
    resetDate: subRow?.monthly_reset_at ? new Date(subRow.monthly_reset_at) : null,
  };
}

// Charge one monthly-quota use. Call ONLY on a route's success path, after
// the feature delivered its result - never before the work runs. Fail-open:
// a bookkeeping failure must never fail a request that already succeeded.
export async function consumeLimit(userId: string, feature: Feature): Promise<void> {
  if (ENABLE_FREEMIUM === 'false' || isAdminUser(userId)) return;
  // The applications cap is enforced by counting rows, not a counter.
  if (feature === 'applications') return;

  try {
    const svc = serviceClient();
    const plan = await resolvePlan(svc, userId);
    if (plan === 'pro') return;

    const column = FEATURE_COLUMNS[feature];
    // Optimistic-lock increment (retry a few times on races). No cap guard:
    // the work already happened, so the counter must reflect it even if
    // concurrent requests briefly pushed usage past the limit.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data } = await svc.from('subscriptions').select(column).eq('user_id', userId).limit(1).single();
      const current = data ? Number((data as Record<string, unknown>)[column]) || 0 : 0;
      const { data: updated } = await (svc.from('subscriptions') as any)
        .update({ [column]: current + 1 })
        .eq('user_id', userId)
        .eq(column, current)
        .select();
      if (updated && updated.length) return;
    }
  } catch {
    // Fail silently
  }
}

export async function getRemainingLimits(userId: string): Promise<Record<string, number>> {
  if (ENABLE_FREEMIUM === 'false' || isAdminUser(userId)) {
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
        const { count } = await svc.from('applications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('deleted_at', null);
        const used = typeof count === 'number' ? count : 0;
        out[key] = Math.max(0, LIMITS.applications - used);
      } catch {
        out[key] = LIMITS.applications;
      }
    } else {
      const col = FEATURE_COLUMNS[key];
      const used = Number(countsRow[col]) || 0;
      out[key] = Math.max(0, LIMITS[key] - used);
    }
  }

  return out;
}

// -- Sliding-window per-route rate limiter -------------------------------------
// Uses the rate_limit_logs table. Each row is one API call; we count rows
// within the rolling window. This is separate from the monthly feature quota.

// Three distinct tiers, each with its own limit AND window:
//   dev  - ENABLE_FREEMIUM=false: everyone, per day (devWindowMinutes = 1440)
//   free - ENABLE_FREEMIUM=true + free/no subscription, per month (43200)
//   pro  - ENABLE_FREEMIUM=true + pro+active, per day (1440)
export interface RateLimitConfig {
  key: string;
  userId: string;
  devLimit: number;
  freeLimit: number;
  proLimit: number;
  devWindowMinutes: number;
  freeWindowMinutes: number;
  proWindowMinutes: number;
}

export type Tier = 'dev' | 'free' | 'pro';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  tier: Tier;
}

const FREEMIUM_ON = ENABLE_FREEMIUM === 'true';

// Resolve a user's effective plan. Only 'pro' + 'active' counts as pro; any
// missing row, error, or non-active status falls back to the free tier.
async function resolvePlan(svc: ServiceClient, userId: string): Promise<'free' | 'pro'> {
  try {
    const { data } = await svc
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', userId)
      .limit(1)
      .single();
    if (data && data.plan === 'pro' && data.status === 'active') return 'pro';
  } catch {
    // Fall through to free
  }
  return 'free';
}

// The tier a user falls into right now. Dev mode collapses everyone to 'dev';
// otherwise pro+active is 'pro' and everything else (including no row) is 'free'.
export async function resolveUserTier(userId: string): Promise<Tier> {
  if (!FREEMIUM_ON) return 'dev';
  const svc = serviceClient();
  const plan = await resolvePlan(svc, userId);
  return plan === 'pro' ? 'pro' : 'free';
}

export async function checkRateLimit(cfg: RateLimitConfig): Promise<RateLimitResult> {
  const { key, userId } = cfg;

  // Admin bypass: no counting, no logging, always allowed.
  if (isAdminUser(userId)) {
    const resetAt = new Date(Date.now() + cfg.devWindowMinutes * 60 * 1000);
    return { allowed: true, remaining: cfg.devLimit, resetAt, tier: 'dev' };
  }

  const svc = serviceClient();
  const now = new Date();

  const tier = await resolveUserTier(userId);
  const maxRequests =
    tier === 'dev' ? cfg.devLimit : tier === 'pro' ? cfg.proLimit : cfg.freeLimit;
  const windowMinutes =
    tier === 'dev'
      ? cfg.devWindowMinutes
      : tier === 'pro'
        ? cfg.proWindowMinutes
        : cfg.freeWindowMinutes;

  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);
  const resetAt = new Date(now.getTime() + windowMinutes * 60 * 1000);

  try {
    // Count requests in window
    const { count, error: countError } = await svc
      .from('rate_limit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('key', key)
      .eq('user_id', userId)
      .gte('created_at', windowStart.toISOString());

    if (countError) {
      // Fail open - don't block on DB errors
      return { allowed: true, remaining: maxRequests, resetAt, tier };
    }

    const used = typeof count === 'number' ? count : 0;

    if (used >= maxRequests) {
      return { allowed: false, remaining: 0, resetAt, tier };
    }

    // Read-only: the log row is written by recordRateLimitUse(), which
    // routes call only on their success path.
    return { allowed: true, remaining: Math.max(0, maxRequests - used), resetAt, tier };
  } catch {
    // Fail open
    return { allowed: true, remaining: maxRequests, resetAt, tier };
  }
}

// Count one use against a sliding-window rate limit. Call ONLY on a route's
// success path - failed requests never burn a use. Fail-silent: a missed log
// must never fail a request that already succeeded.
export async function recordRateLimitUse(key: string, userId: string): Promise<void> {
  // Admin is never counted or logged (matches the checkRateLimit bypass).
  if (isAdminUser(userId)) return;
  try {
    const svc = serviceClient();
    await svc.from('rate_limit_logs').insert({ key, user_id: userId });
  } catch {
    // Fail silently
  }
}

export function rateLimitResponse(resetAt: Date, remaining: number, tier: Tier = 'dev'): Response {
  const retryAfter = Math.max(0, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
  // Only the free (monthly) tier mentions upgrading; dev and pro both hit a
  // daily wall and simply reset tomorrow.
  const message =
    tier === 'free'
      ? 'Monthly limit reached. Upgrade to Pro for higher limits or try again next month.'
      : 'Daily limit reached. Try again tomorrow.';
  return new Response(
    JSON.stringify({
      error: message,
      resetAt: resetAt.toISOString(),
      retryAfter,
      remaining,
    }),
    {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

// -- Platform-wide shared quotas -----------------------------------------------
// For third-party APIs with account-level caps (SerpApi monthly, Jina lifetime).
// Backed by the platform_limits table; service-role only (RLS denies everyone).

interface SharedQuotaResult {
  allowed: boolean;
  used: number;
  max: number;
  daysUntilReset: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function checkSharedQuota(
  key: string,
  maxCount: number,
  windowDays: number
): Promise<SharedQuotaResult> {
  const svc = serviceClient();
  const now = new Date();
  const windowMs = windowDays * DAY_MS;

  try {
    let { data } = await svc
      .from('platform_limits')
      .select('key, count, window_start')
      .eq('key', key)
      .maybeSingle();

    if (!data) {
      // First use of this quota - seed the row.
      await svc
        .from('platform_limits')
        .insert({ key, count: 0, window_start: now.toISOString() });
      data = { key, count: 0, window_start: now.toISOString() };
    }

    let windowStart = new Date(data.window_start);
    let count = Number(data.count) || 0;

    // Reset the window if it has fully elapsed.
    if (now.getTime() - windowStart.getTime() >= windowMs) {
      await svc
        .from('platform_limits')
        .update({ count: 0, window_start: now.toISOString() })
        .eq('key', key);
      count = 0;
      windowStart = now;
    }

    const resetAt = new Date(windowStart.getTime() + windowMs);
    const daysUntilReset = Math.max(0, Math.ceil((resetAt.getTime() - now.getTime()) / DAY_MS));

    return { allowed: count < maxCount, used: count, max: maxCount, daysUntilReset };
  } catch {
    // Fail open - never hard-block on a bookkeeping failure.
    return { allowed: true, used: 0, max: maxCount, daysUntilReset: windowDays };
  }
}

// Increment happens ONLY after a successful external API call, never before.
export async function incrementSharedQuota(key: string): Promise<void> {
  const svc = serviceClient();
  try {
    // Atomic count = count + 1 via a SQL function (see the platform_limits migration).
    const { error } = await svc.rpc('increment_platform_limit', { p_key: key });
    if (!error) return;
  } catch {
    // Fall through to a best-effort read-modify-write.
  }
  try {
    const { data } = await svc
      .from('platform_limits')
      .select('count')
      .eq('key', key)
      .maybeSingle();
    const current = data ? Number(data.count) || 0 : 0;
    await svc
      .from('platform_limits')
      .update({ count: current + 1 })
      .eq('key', key);
  } catch {
    // Fail silently - quota drift is acceptable, blocking a user is not.
  }
}

// Jina reader has a lifetime free-token allowance. We can't cheaply count
// tokens, so we cap request count: ~7k tokens/scrape against a ~1M allowance
// leaves ~140 safe scrapes; 150 with headroom, over a 100-year "lifetime".
export async function checkJinaQuota(): Promise<SharedQuotaResult> {
  return checkSharedQuota('jina_lifetime', 150, 36500);
}

export async function incrementJinaQuota(): Promise<void> {
  return incrementSharedQuota('jina_lifetime');
}

// -- Usage-limits overview (powers the /limits page) ----------------------------
// One entry per rate-limited feature, mirroring the numbers each route passes
// to checkRateLimit. If a route's numbers change, change them here too.

export interface RateLimitSpec {
  key: string;
  label: string;
  devLimit: number;
  freeLimit: number;
  proLimit: number;
  /** True when pro users skip this limit entirely. */
  proUnlimited?: boolean;
}

export const RATE_LIMIT_SPECS: RateLimitSpec[] = [
  { key: 'tailor-resume', label: 'Resume tailoring', devLimit: 1, freeLimit: 10, proLimit: 5 },
  { key: 'ats-score', label: 'ATS score checks', devLimit: 2, freeLimit: 10, proLimit: 7 },
  { key: 'cover-letter', label: 'Cover letters', devLimit: 1, freeLimit: 10, proLimit: 4 },
  { key: 'parse-job', label: 'Job posting parses', devLimit: 5, freeLimit: 20, proLimit: 10 },
  { key: 'answer-question', label: 'Application question answers', devLimit: 5, freeLimit: 15, proLimit: 10 },
  { key: 'analyze-form', label: 'Application form analyses', devLimit: 2, freeLimit: 10, proLimit: 10 },
  { key: 'extension-ai-fill', label: 'Extension auto-fills', devLimit: 2, freeLimit: 20, proLimit: 10 },
  { key: 'interview-prep-generate', label: 'Interview practice sessions', devLimit: 1, freeLimit: 5, proLimit: 5 },
  { key: 'interview-prep-assess', label: 'Interview answer feedback', devLimit: 5, freeLimit: 15, proLimit: 10 },
  { key: 'networking-outreach', label: 'Outreach message generations', devLimit: 2, freeLimit: 15, proLimit: 7 },
  { key: 'find-contacts', label: 'Contact searches', devLimit: 1, freeLimit: 3, proLimit: 1 },
  { key: 'discover-jobs-refresh', label: 'Job feed refreshes', devLimit: 1, freeLimit: 3, proLimit: 1 },
  { key: 'strategy-feedback', label: 'Strategy feedback generations', devLimit: 2, freeLimit: 2, proLimit: 5, proUnlimited: true },
  { key: 'parse-resume', label: 'Resume uploads parsed', devLimit: 1, freeLimit: 3, proLimit: 1 },
  { key: 'parse-profile', label: 'Profile imports', devLimit: 1, freeLimit: 3, proLimit: 1 },
  { key: 'app-chat', label: 'Help chat messages', devLimit: 5, freeLimit: 50, proLimit: 10 },
  { key: 'resume-studio', label: 'Resume Studio edits', devLimit: 10, freeLimit: 20, proLimit: 15 },
  { key: 'render-resume', label: 'Full resume renders', devLimit: 5, freeLimit: 10, proLimit: 10 },
  { key: 'resume-pdf', label: 'Resume PDF downloads', devLimit: 20, freeLimit: 40, proLimit: 60 },
];

export interface RateLimitStatus {
  key: string;
  label: string;
  used: number;
  limit: number;
  remaining: number;
  /** ISO timestamp when the oldest counted call leaves the window, null if unused. */
  resetAt: string | null;
  unlimited: boolean;
}

export interface RateLimitOverview {
  tier: Tier;
  isAdmin: boolean;
  /** 'day' for dev/pro tiers, 'month' for the free tier. */
  window: 'day' | 'month';
  statuses: RateLimitStatus[];
}

/**
 * Current usage against every per-route rate limit for one user, computed
 * from rate_limit_logs the same way checkRateLimit counts them.
 */
export async function getRateLimitOverview(userId: string): Promise<RateLimitOverview> {
  const admin = isAdminUser(userId);
  const tier: Tier = admin ? 'dev' : await resolveUserTier(userId);
  const windowMinutes = tier === 'free' ? 43200 : 1440;
  const windowLabel: 'day' | 'month' = tier === 'free' ? 'month' : 'day';
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  let logs: Array<{ key: string; created_at: string }> = [];
  if (!admin) {
    try {
      const svc = serviceClient();
      const { data } = await svc
        .from('rate_limit_logs')
        .select('key, created_at')
        .eq('user_id', userId)
        .gte('created_at', windowStart.toISOString());
      logs = (data ?? []) as Array<{ key: string; created_at: string }>;
    } catch {
      // Fail open: the page shows zero usage rather than erroring.
    }
  }

  const byKey = new Map<string, string[]>();
  for (const log of logs) {
    const list = byKey.get(log.key) ?? [];
    list.push(log.created_at);
    byKey.set(log.key, list);
  }

  const statuses: RateLimitStatus[] = RATE_LIMIT_SPECS.map((spec) => {
    const unlimited = admin || (tier === 'pro' && Boolean(spec.proUnlimited));
    const limit = tier === 'free' ? spec.freeLimit : tier === 'pro' ? spec.proLimit : spec.devLimit;
    const timestamps = (byKey.get(spec.key) ?? []).sort();
    const used = timestamps.length;
    const resetAt = timestamps.length > 0
      ? new Date(new Date(timestamps[0]).getTime() + windowMinutes * 60 * 1000).toISOString()
      : null;
    return {
      key: spec.key,
      label: spec.label,
      used,
      limit,
      remaining: unlimited ? limit : Math.max(0, limit - used),
      resetAt,
      unlimited,
    };
  });

  return { tier, isAdmin: admin, window: windowLabel, statuses };
}

export default { checkLimit, getRemainingLimits, LIMITS };
