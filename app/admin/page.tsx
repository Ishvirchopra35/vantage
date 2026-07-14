import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import AdminCampaignForm from '@/components/AdminCampaignForm';
import AdminResetAnalytics from '@/components/AdminResetAnalytics';

export const dynamic = 'force-dynamic';

const MRR_PER_SUBSCRIPTION = 8;

type ProfileRow = {
  id: string;
  created_at: string;
};

type SubscriptionRow = {
  user_id: string | null;
  plan: string | null;
  status: string | null;
  cancelled_at: string | null;
  created_at: string | null;
};

type EventRow = {
  user_id: string | null;
  event_name: string | null;
  properties: Record<string, unknown> | null;
  created_at: string;
};

type AtsScoreRow = {
  job_id: string | null;
  document_id: string | null;
  resume_id: string | null;
  overall_score: number | null;
  created_at: string | null;
};

type RouteLogRow = {
  route: string;
  duration_ms: number;
  created_at: string;
};

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfWeek(date: Date): Date {
  const copy = startOfDay(date);
  const day = copy.getDay();
  const delta = (day + 6) % 7;
  copy.setDate(copy.getDate() - delta);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '-';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatPercentPlain(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '-';
  return `${value.toFixed(1)}%`;
}

function formatRelativeTime(dateValue: string): string {
  const diffMs = Date.now() - new Date(dateValue).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function compactJson(properties: Record<string, unknown> | null): string {
  if (!properties || Object.keys(properties).length === 0) return '-';
  const raw = JSON.stringify(properties);
  return raw.length > 140 ? `${raw.slice(0, 137)}...` : raw;
}

function cellValue(value: number | string, change: number | null) {
  return {
    value,
    change,
  };
}

export default async function AdminPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  const adminUserId = process.env.ADMIN_USER_ID;
  if (!user || !adminUserId || user.id !== adminUserId) {
    redirect('/dashboard');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service role configuration.');
  }

  const svc = createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const weekStart = startOfWeek(now);
  const lastWeekStart = addDays(weekStart, -7);
  const twoWeeksAgoStart = addDays(weekStart, -14);
  const sevenDaysAgo = addDays(now, -7);
  const fourteenDaysAgo = addDays(now, -14);
  const thirtyDaysAgo = addDays(now, -30);
  const thirtyFiveDaysAgo = addDays(now, -35);
  const twentyEightDaysAgo = addDays(now, -28);
  const twentyOneDaysAgo = addDays(now, -21);
  const fourteenDaysAgoStart = addDays(now, -14);
  const eightDaysAgo = addDays(now, -8);
  const sixDaysAgo = addDays(now, -6);

  const [profilesResult, subscriptionsResult, eventsResult, atsScoresResult, routeLogsResult] = await Promise.all([
    svc.from('profiles').select('id, created_at').order('created_at', { ascending: false }),
    svc
      .from('subscriptions')
      .select('user_id, plan, status, cancelled_at, created_at')
      .order('created_at', { ascending: false }),
    // Guardrails, not pagination: this page aggregates in memory, so cap the
    // two unbounded tables at the most recent 50k rows. Totals silently
    // become "last 50k" past that - use Reset analytics to keep them small.
    svc
      .from('events')
      .select('user_id, event_name, properties, created_at')
      .order('created_at', { ascending: false })
      .limit(50000),
    svc
      .from('ats_scores')
      .select('job_id, document_id, resume_id, overall_score, created_at'),
    svc
      .from('route_logs')
      .select('route, duration_ms, created_at')
      .order('created_at', { ascending: false })
      .limit(50000),
  ]);

  // Marketing subscriber count for the campaign form. The column arrives
  // with the batch3 migration; before it runs this simply reads as 0.
  let optedInCount = 0;
  try {
    const { count } = await svc
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('marketing_emails_enabled', true)
      .not('email', 'is', null);
    optedInCount = count ?? 0;
  } catch {
    optedInCount = 0;
  }

  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const subscriptions = (subscriptionsResult.data ?? []) as SubscriptionRow[];
  const events = (eventsResult.data ?? []) as EventRow[];
  const atsScores = (atsScoresResult.data ?? []) as AtsScoreRow[];
  const routeLogs = (routeLogsResult.data ?? []) as RouteLogRow[];

  const revenueEnabled = process.env.ENABLE_FREEMIUM === 'true';
  const activeProSubscriptions = subscriptions.filter(
    (subscription) =>
      subscription.plan === 'pro' &&
      subscription.status === 'active' &&
      subscription.created_at !== null &&
      new Date(subscription.created_at) <= now &&
      (!subscription.cancelled_at || new Date(subscription.cancelled_at) > now)
  ).length;

  const activeProAtMonthStart = subscriptions.filter(
    (subscription) => {
      if (subscription.plan !== 'pro' || subscription.status !== 'active' || !subscription.created_at) {
        return false;
      }
      const createdAt = new Date(subscription.created_at);
      const cancelledAt = subscription.cancelled_at ? new Date(subscription.cancelled_at) : null;
      return createdAt <= monthStart && (!cancelledAt || cancelledAt >= monthStart);
    }
  ).length;

  const churnedThisMonth = subscriptions.filter(
    (subscription) =>
      subscription.plan === 'pro' &&
      subscription.status === 'cancelled' &&
      subscription.cancelled_at !== null &&
      new Date(subscription.cancelled_at) >= monthStart
  ).length;

  const totalUsers = profiles.length;
  const newThisWeek = profiles.filter((profile) => new Date(profile.created_at) >= sevenDaysAgo).length;
  const newLastWeek = profiles.filter(
    (profile) => new Date(profile.created_at) >= fourteenDaysAgo && new Date(profile.created_at) < sevenDaysAgo
  ).length;
  const wowNewUsers = newLastWeek > 0 ? ((newThisWeek - newLastWeek) / newLastWeek) * 100 : null;

  const tailoredUsers = new Set(
    events.filter((event) => event.event_name === 'tailored_resume' && event.user_id).map((event) => event.user_id as string)
  ).size;
  const activationRate = totalUsers > 0 ? (tailoredUsers / totalUsers) * 100 : null;

  const wau = new Set(
    events.filter((event) => new Date(event.created_at) >= sevenDaysAgo && event.user_id).map((event) => event.user_id as string)
  ).size;
  const mau = new Set(
    events.filter((event) => new Date(event.created_at) >= thirtyDaysAgo && event.user_id).map((event) => event.user_id as string)
  ).size;
  const stickiness = mau > 0 ? (wau / mau) * 100 : null;

  const week4Signups = profiles.filter(
    (profile) => new Date(profile.created_at) >= thirtyFiveDaysAgo && new Date(profile.created_at) < twentyEightDaysAgo
  );
  const week4Active = week4Signups.filter((profile) =>
    events.some(
      (event) =>
        event.user_id === profile.id &&
        new Date(event.created_at) >= sevenDaysAgo &&
        new Date(event.created_at) <= now
    )
  ).length;
  const week4Retention = week4Signups.length > 0 ? (week4Active / week4Signups.length) * 100 : null;

  const week2Signups = profiles.filter(
    (profile) => new Date(profile.created_at) >= twentyOneDaysAgo && new Date(profile.created_at) < fourteenDaysAgoStart
  );
  const week2Active = week2Signups.filter((profile) => {
    const accountCreated = new Date(profile.created_at);
    const windowStart = addDays(accountCreated, 8);
    const windowEnd = addDays(accountCreated, 14);
    return events.some(
      (event) =>
        event.user_id === profile.id &&
        new Date(event.created_at) >= windowStart &&
        new Date(event.created_at) < windowEnd
    );
  }).length;
  const week2Retention = week2Signups.length > 0 ? (week2Active / week2Signups.length) * 100 : null;

  const totalTailorings = events.filter((event) => event.event_name === 'tailored_resume').length;
  const tailoringsThisWeek = events.filter(
    (event) => event.event_name === 'tailored_resume' && new Date(event.created_at) >= weekStart
  ).length;
  const tailoringsLastWeek = events.filter(
    (event) => event.event_name === 'tailored_resume' && new Date(event.created_at) >= lastWeekStart && new Date(event.created_at) < weekStart
  ).length;
  const tailoringsWow = tailoringsLastWeek > 0 ? ((tailoringsThisWeek - tailoringsLastWeek) / tailoringsLastWeek) * 100 : null;

  const totalAtsChecks = events.filter((event) => event.event_name === 'ats_score_checked').length;
  const avgAtsScoreRows = atsScores.filter((row) => row.overall_score !== null).map((row) => row.overall_score as number);
  const avgAtsScore = avgAtsScoreRows.length > 0 ? avgAtsScoreRows.reduce((sum, value) => sum + value, 0) / avgAtsScoreRows.length : null;

  const improvementValues = atsScores
    .filter((tailored) => tailored.document_id !== null && tailored.job_id !== null)
    .map((tailored) => {
      const matchingBase = atsScores.find(
        (base) =>
          base.job_id === tailored.job_id &&
          base.resume_id !== null &&
          base.overall_score !== null &&
          tailored.overall_score !== null
      );
      if (!matchingBase || matchingBase.overall_score === null || tailored.overall_score === null) {
        return null;
      }
      return tailored.overall_score - matchingBase.overall_score;
    })
    .filter((value): value is number => value !== null);
  const avgImprovement = improvementValues.length > 0 ? improvementValues.reduce((sum, value) => sum + value, 0) / improvementValues.length : null;

  const totalCoverLetters = events.filter((event) => event.event_name === 'generated_cover_letter').length;
  const totalApplicationsLogged = events.filter((event) => event.event_name === 'logged_application').length;

  const titleCounts = new Map<string, number>();
  for (const event of events) {
    const title = typeof event.properties?.job_title === 'string' ? event.properties.job_title.trim() : '';
    if (!title) continue;
    titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
  }
  const topJobTitles = Array.from(titleCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const weeklyRows = Array.from({ length: 12 }, (_, index) => addDays(weekStart, -index * 7));

  const weeklyGrowth = weeklyRows.map((weekStartDate) => {
    const weekEnd = addDays(weekStartDate, 7);
    const newUsers = profiles.filter((profile) => {
      const createdAt = new Date(profile.created_at);
      return createdAt >= weekStartDate && createdAt < weekEnd;
    }).length;

    const tailorings = events.filter(
      (event) => event.event_name === 'tailored_resume' && new Date(event.created_at) >= weekStartDate && new Date(event.created_at) < weekEnd
    ).length;

    const atsChecks = events.filter(
      (event) => event.event_name === 'ats_score_checked' && new Date(event.created_at) >= weekStartDate && new Date(event.created_at) < weekEnd
    ).length;

    const wauForWeek = new Set(
      events.filter((event) => new Date(event.created_at) >= weekStartDate && new Date(event.created_at) < weekEnd && event.user_id).map((event) => event.user_id as string)
    ).size;

    const activeProForWeek = subscriptions.filter((subscription) => {
      if (subscription.plan !== 'pro' || subscription.status !== 'active' || !subscription.created_at) return false;
      const createdAt = new Date(subscription.created_at);
      const cancelledAt = subscription.cancelled_at ? new Date(subscription.cancelled_at) : null;
      return createdAt <= weekEnd && (!cancelledAt || cancelledAt > weekEnd);
    }).length;

    return {
      weekStart: weekStartDate,
      newUsers,
      tailorings,
      atsChecks,
      wau: wauForWeek,
      mrr: activeProForWeek * MRR_PER_SUBSCRIPTION,
    };
  });

  const weeklyGrowthWithChanges = weeklyGrowth.map((row, index) => {
    const previous = weeklyGrowth[index - 1] ?? null;
    return {
      ...row,
      changes: {
        newUsers: previous ? (previous.newUsers > 0 ? ((row.newUsers - previous.newUsers) / previous.newUsers) * 100 : null) : null,
        tailorings: previous ? (previous.tailorings > 0 ? ((row.tailorings - previous.tailorings) / previous.tailorings) * 100 : null) : null,
        atsChecks: previous ? (previous.atsChecks > 0 ? ((row.atsChecks - previous.atsChecks) / previous.atsChecks) * 100 : null) : null,
        wau: previous ? (previous.wau > 0 ? ((row.wau - previous.wau) / previous.wau) * 100 : null) : null,
        mrr: previous ? (previous.mrr > 0 ? ((row.mrr - previous.mrr) / previous.mrr) * 100 : null) : null,
      },
    };
  });

  const recentEvents = events
    .filter((event) => new Date(event.created_at) >= thirtyDaysAgo)
    .slice(0, 30);

  const routePerformance = Array.from(
    routeLogs.reduce<Map<string, { total: number; count: number }>>((accumulator, row) => {
      const current = accumulator.get(row.route) ?? { total: 0, count: 0 };
      current.total += row.duration_ms;
      current.count += 1;
      accumulator.set(row.route, current);
      return accumulator;
    }, new Map())
  )
    .map(([route, aggregate]) => ({ route, average: aggregate.total / aggregate.count, count: aggregate.count }))
    .sort((a, b) => b.average - a.average)
    .slice(0, 10);

  const pageCardStyle = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '20px',
    marginBottom: '16px',
  } as const;

  const metricStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    padding: '16px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    background: 'var(--bg)',
  } as const;

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse' as const,
    minWidth: '720px',
  } as const;

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px 80px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>Admin</h1>
          <p style={{ marginTop: '6px', color: 'var(--muted)', fontSize: '0.95rem' }}>Operational metrics and system health.</p>
        </div>
        <Link
          href="/admin"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '44px',
            padding: '0 16px',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            textDecoration: 'none',
            fontSize: '0.95rem',
            fontWeight: 600,
          }}
        >
          Refresh
        </Link>
      </div>

      {revenueEnabled && (
        <section style={pageCardStyle}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>Revenue</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div style={metricStyle}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>{formatMoney(activeProSubscriptions * MRR_PER_SUBSCRIPTION)}</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Current MRR</div>
            </div>
            <div style={metricStyle}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>{formatCount(activeProSubscriptions)}</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Total Pro subscribers</div>
            </div>
            <div style={metricStyle}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>
                {activeProAtMonthStart > 0 ? formatPercentPlain((churnedThisMonth / activeProAtMonthStart) * 100) : '-'}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Churn this month</div>
            </div>
          </div>
        </section>
      )}

      <section style={pageCardStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>Users</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div style={metricStyle}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>{formatCount(totalUsers)}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Total registered</div>
          </div>
          <div style={metricStyle}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>{formatCount(newThisWeek)}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>New this week</div>
          </div>
          <div style={metricStyle}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>{formatCount(newLastWeek)}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>New last week</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{formatPercent(wowNewUsers)}</div>
          </div>
          <div style={metricStyle}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>{formatPercentPlain(activationRate)}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Activation rate</div>
          </div>
          <div style={metricStyle}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>{formatCount(wau)}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>WAU</div>
          </div>
          <div style={metricStyle}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>{formatCount(mau)}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>MAU</div>
          </div>
          <div style={metricStyle}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>{formatPercentPlain(stickiness)}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Stickiness</div>
          </div>
        </div>
      </section>

      <section style={pageCardStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>Retention cohorts</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div style={metricStyle}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)' }}>{formatPercentPlain(week4Retention)}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Week 4 retention</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{formatCount(week4Signups.length)} signups aged 28-35 days</div>
          </div>
          <div style={metricStyle}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)' }}>{formatPercentPlain(week2Retention)}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Week 2 retention</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{formatCount(week2Signups.length)} signups aged 14-21 days</div>
          </div>
        </div>
      </section>

      <section style={pageCardStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>Product usage</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div style={metricStyle}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>{formatCount(totalTailorings)}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Total tailorings</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{formatCount(tailoringsThisWeek)} this week • {formatPercent(tailoringsWow)}</div>
          </div>
          <div style={metricStyle}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>{formatCount(totalAtsChecks)}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Total ATS scores</div>
          </div>
          <div style={metricStyle}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>{avgAtsScore === null ? '-' : avgAtsScore.toFixed(1)}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Average ATS score</div>
          </div>
          <div style={metricStyle}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>{avgImprovement === null ? '-' : avgImprovement.toFixed(1)}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Average improvement</div>
          </div>
          <div style={metricStyle}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>{formatCount(totalCoverLetters)}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Total cover letters</div>
          </div>
          <div style={metricStyle}>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text)' }}>{formatCount(totalApplicationsLogged)}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Applications logged</div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', marginBottom: '10px' }}>Top job titles</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {topJobTitles.length > 0 ? (
              topJobTitles.map(([title, count]) => (
                <span
                  key={title}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '6px 10px',
                    borderRadius: '999px',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: '0.9rem',
                  }}
                >
                  {title} · {count}
                </span>
              ))
            ) : (
              <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No titles recorded yet.</span>
            )}
          </div>
        </div>
      </section>

      <section style={pageCardStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>Growth table</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Week starting', 'New users', 'Tailorings', 'ATS scores', 'WAU', 'MRR'].map((heading) => (
                  <th key={heading} style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeklyGrowthWithChanges.map((row) => (
                <tr key={row.weekStart.toISOString()} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 8px', color: 'var(--text)', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>
                    {row.weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  {[
                    cellValue(row.newUsers, row.changes.newUsers),
                    cellValue(row.tailorings, row.changes.tailorings),
                    cellValue(row.atsChecks, row.changes.atsChecks),
                    cellValue(row.wau, row.changes.wau),
                    cellValue(formatMoney(row.mrr), row.changes.mrr),
                  ].map((cell, index) => (
                    <td key={index} style={{ padding: '12px 8px', color: 'var(--text)', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>
                      <div>{cell.value}</div>
                      <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{formatPercent(cell.change)}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={pageCardStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>Recent events</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Timestamp', 'User ID', 'Event', 'Key properties'].map((heading) => (
                  <th key={heading} style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((event) => (
                <tr key={`${event.created_at}-${event.event_name}-${event.user_id}`} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 8px', color: 'var(--text)', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>{formatRelativeTime(event.created_at)}</td>
                  <td style={{ padding: '12px 8px', color: 'var(--muted)', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>{event.user_id ? event.user_id.slice(0, 8) : '-'}</td>
                  <td style={{ padding: '12px 8px', color: 'var(--text)', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>{event.event_name ?? '-'}</td>
                  <td style={{ padding: '12px 8px', color: 'var(--muted)', fontSize: '0.9rem', fontFamily: 'monospace', wordBreak: 'break-word' }}>{compactJson(event.properties)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={pageCardStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>Route performance</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Route', 'Avg duration', 'Requests'].map((heading) => (
                  <th key={heading} style={{ textAlign: 'left', padding: '10px 8px', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {routePerformance.map((row) => {
                const hot = row.average > 5000;
                return (
                  <tr key={row.route} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 8px', color: 'var(--text)', fontSize: '0.95rem' }}>{row.route}</td>
                    <td style={{ padding: '12px 8px', color: hot ? 'var(--score-red)' : 'var(--text)', fontSize: '0.95rem', fontWeight: 600 }}>{Math.round(row.average)}ms</td>
                    <td style={{ padding: '12px 8px', color: 'var(--muted)', fontSize: '0.95rem' }}>{formatCount(row.count)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section style={pageCardStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>Email campaign</h2>
        <AdminCampaignForm optedInCount={optedInCount} />
      </section>

      <section style={pageCardStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>Maintenance</h2>
        <AdminResetAnalytics />
      </section>
    </main>
  );
}
