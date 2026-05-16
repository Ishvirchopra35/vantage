import type { CSSProperties } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Dashboard - Vantage',
  description: 'Your job search overview',
};

type ProfileRow = {
  full_name: string | null;
  email: string | null;
  skills: string[] | null;
  target_roles: string[] | null;
};

type ApplicationStatus = 'applied' | 'interviewing' | 'rejected' | 'offer' | 'ghosted';

type ApplicationRow = {
  id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  created_at: string;
};

type DocumentRow = {
  id: string;
  type: 'tailored_resume' | 'cover_letter';
  created_at: string;
  jobs: { title: string | null; company: string | null } | null | Array<{ title: string | null; company: string | null }>;
};

type AtsScoreRow = {
  id: string;
  overall_score: number | null;
  scored_at: string;
  jobs: { title: string | null; company: string | null } | null | Array<{ title: string | null; company: string | null }>;
};

type ScoreRow = {
  overall_score: number | null;
};

type SubscriptionRow = {
  plan: 'free' | 'pro' | null;
};

function getFirstName(profile: ProfileRow | null, email: string | null | undefined): string {
  const fromProfile = profile?.full_name?.trim().split(/\s+/).filter(Boolean)[0];
  if (fromProfile) return fromProfile;
  const fromEmail = email?.split('@')[0]?.trim();
  if (fromEmail) return fromEmail;
  return 'there';
}

function getTimeBucket(): 'morning' | 'afternoon' | 'evening' {
  const estHour = (new Date().getUTCHours() + 19) % 24;
  if (estHour < 12) return 'morning';
  if (estHour < 18) return 'afternoon';
  return 'evening';
}

function daysAgo(dateValue: string): string {
  const diffMs = Date.now() - new Date(dateValue).getTime();
  const days = Math.max(0, Math.floor(diffMs / 86_400_000));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
}

function formatDate(dateValue: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateValue));
}

function scoreBadgeStyle(score: number): CSSProperties {
  if (score >= 75) {
    return {
      borderColor: 'rgba(34,197,94,0.35)',
      background: 'rgba(34,197,94,0.12)',
      color: '#86efac',
    };
  }
  if (score >= 50) {
    return {
      borderColor: 'rgba(245,158,11,0.35)',
      background: 'rgba(245,158,11,0.12)',
      color: '#fbbf24',
    };
  }
  return {
    borderColor: 'rgba(239,68,68,0.35)',
    background: 'rgba(239,68,68,0.12)',
    color: '#fca5a5',
  };
}

function documentTypeLabel(type: DocumentRow['type']): string {
  return type === 'tailored_resume' ? 'Tailored Resume' : 'Cover Letter';
}

function firstJoinedJob(
  jobs: DocumentRow['jobs'] | AtsScoreRow['jobs']
): { title: string | null; company: string | null } | null {
  if (!jobs) return null;
  if (Array.isArray(jobs)) return jobs[0] ?? null;
  return jobs;
}

function applicationStatusClass(status: ApplicationStatus): string {
  return `status-badge status-${status}`;
}

export default async function DashboardPage() {
  const enableFreemium = process.env.NEXT_PUBLIC_ENABLE_FREEMIUM === 'true';
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/login');
  }

  const [
    profileResult,
    applicationsResult,
    documentsResult,
    atsScoresResult,
    subscriptionResult,
    weeklyTailoringsResult,
    allAtsScoresResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, email, skills, target_roles')
      .eq('id', user.id)
      .single(),
    supabase
      .from('applications')
      .select('id, company, role, status, created_at')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('documents')
      .select('id, type, created_at, jobs(title, company)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('ats_scores')
      .select('id, overall_score, scored_at, jobs(title, company)')
      .eq('user_id', user.id)
      .order('scored_at', { ascending: false })
      .limit(5),
    supabase
      .from('subscriptions')
      .select('plan')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('type', 'tailored_resume')
      .gt('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString()),
    supabase
      .from('ats_scores')
      .select('overall_score')
      .eq('user_id', user.id),
  ]);

  const profile = profileResult.data as ProfileRow | null;
  const applications = (applicationsResult.data ?? []) as ApplicationRow[];
  const documents = (documentsResult.data ?? []) as DocumentRow[];
  const atsScores = (atsScoresResult.data ?? []) as AtsScoreRow[];
  const allAtsScores = (allAtsScoresResult.data ?? []) as ScoreRow[];
  const subscription = subscriptionResult.data as SubscriptionRow | null;

  const firstName = getFirstName(profile, user.email);
  const bucket = getTimeBucket();
  const plan = subscription?.plan === 'pro' ? 'Pro' : 'Free';
  const profileComplete = Boolean((profile?.skills?.length ?? 0) > 0 && (profile?.target_roles?.length ?? 0) > 0);

  const totalApplications = applications.length;
  const activeInterviews = applications.filter((application) => application.status === 'interviewing').length;
  const responseCount = applications.filter(
    (application) => application.status === 'interviewing' || application.status === 'offer'
  ).length;
  const responseRate =
    totalApplications > 0 ? `${((responseCount / totalApplications) * 100).toFixed(1)}%` : '—';
  const tailoringsThisWeek = weeklyTailoringsResult.count ?? 0;
  const avgAtsScoreValues = allAtsScores.map((row) => row.overall_score).filter((score): score is number => score !== null);
  const avgAtsScore =
    avgAtsScoreValues.length > 0
      ? Math.round(avgAtsScoreValues.reduce((sum, score) => sum + score, 0) / avgAtsScoreValues.length)
      : null;

  const recentApplications = applications.slice(0, 5);
  const recentScores = atsScores.slice(0, 3);
  const recentDocs = documents.slice(0, 5);

  const statCardStyle: CSSProperties = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '20px 24px',
  };

  const statValueStyle: CSSProperties = {
    fontSize: '28px',
    fontWeight: 700,
    color: 'var(--text)',
    lineHeight: 1,
  };

  const statLabelStyle: CSSProperties = {
    fontSize: '12px',
    color: 'var(--muted)',
    marginTop: '4px',
  };

  const sectionCardStyle: CSSProperties = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '20px 24px',
    marginBottom: '16px',
  };

  const sectionHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  };

  const sectionTitleStyle: CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
  };

  const viewAllStyle: CSSProperties = {
    fontSize: '12px',
    color: 'var(--muted)',
    textDecoration: 'none',
  };

  const emptyStateStyle: CSSProperties = {
    fontSize: '13px',
    color: 'var(--muted)',
    padding: '16px 0',
  };

  const listStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  };

  const listItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '14px',
    padding: '12px 14px',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    background: 'transparent',
    textDecoration: 'none',
    color: 'inherit',
  };

  return (
    <div>
      {!profileComplete && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: '10px',
            background: 'rgba(59,130,246,0.06)',
            fontSize: '13px',
            color: 'var(--text)',
            marginBottom: '16px',
          }}
        >
          <span>Complete your profile to improve AI output quality.</span>
          <Link href="/profile" style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'none' }}>Profile</Link>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
            Good {bucket}, {firstName}
          </div>
          <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--muted)' }}>
            {totalApplications > 0
              ? `You have ${totalApplications} tracked applications, ${tailoringsThisWeek} tailorings this week, and ${profileComplete ? 'a complete profile' : 'room to improve your profile'}.`
              : 'Start with a tailored resume and a strong first application.'}
          </div>
        </div>

        {enableFreemium && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '4px 10px',
            borderRadius: '999px',
            border: '1px solid var(--border)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text)',
          }}>
            {plan}
          </span>
        )}
      </div>

      <div className="stats-grid">
        <div style={statCardStyle}>
          <div style={statValueStyle}>{totalApplications}</div>
          <div style={statLabelStyle}>Total Applications</div>
        </div>
        <div style={statCardStyle}>
          <div style={statValueStyle}>{responseRate}</div>
          <div style={statLabelStyle}>Response Rate</div>
        </div>
        <div style={statCardStyle}>
          <div style={statValueStyle}>{activeInterviews}</div>
          <div style={statLabelStyle}>Active Interviews</div>
        </div>
        <div style={statCardStyle}>
          <div style={statValueStyle}>{avgAtsScore !== null ? `${avgAtsScore}/100` : 'No scores yet'}</div>
          <div style={statLabelStyle}>Avg ATS Score</div>
        </div>
      </div>

      {totalApplications === 0 && (
        <div style={{ ...sectionCardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
              Tailor your first resume and check your ATS score to get started.
            </div>
          </div>
          <Link href="/tailor" style={{
            background: 'var(--accent)',
            color: '#000',
            border: 'none',
            borderRadius: '10px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            Start tailoring
          </Link>
        </div>
      )}

      <div style={sectionCardStyle}>
        <div style={sectionHeaderStyle}>
          <div style={sectionTitleStyle}>Recent Applications</div>
          <Link href="/tracker" style={viewAllStyle}>
            View all →
          </Link>
        </div>

        {recentApplications.length > 0 ? (
          <div style={listStyle}>
            {recentApplications.map((application) => (
              <div key={application.id} style={listItemStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {application.company} · {application.role}
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--muted)' }}>{daysAgo(application.created_at)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <span className={applicationStatusClass(application.status)}>{application.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={emptyStateStyle}>No applications yet.</div>
        )}
      </div>

      <div style={sectionCardStyle}>
        <div style={sectionHeaderStyle}>
          <div style={sectionTitleStyle}>ATS Score History</div>
          <Link href="/ats" style={viewAllStyle}>
            View all →
          </Link>
        </div>

        {recentScores.length > 0 ? (
          <div style={listStyle}>
            {recentScores.map((score) => {
              const numericScore = score.overall_score ?? 0;
              const job = firstJoinedJob(score.jobs);
              return (
                <div key={score.id} style={listItemStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job?.title || 'Untitled job'}
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job?.company || 'Unknown company'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span className="status-badge" style={scoreBadgeStyle(numericScore)}>
                      {numericScore}/100
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{formatDate(score.scored_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={emptyStateStyle}>No ATS scores yet.</div>
        )}
      </div>

      <div style={{ ...sectionCardStyle, marginBottom: 0 }}>
        <div style={sectionHeaderStyle}>
          <div style={sectionTitleStyle}>Recent Documents</div>
          <Link href="/documents" style={viewAllStyle}>
            View all →
          </Link>
        </div>

        {recentDocs.length > 0 ? (
          <div style={listStyle}>
            {recentDocs.map((document) => {
              const job = firstJoinedJob(document.jobs);
              return (
                <Link key={document.id} href={`/documents/${document.id}`} style={listItemStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {documentTypeLabel(document.type)}
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job?.title || job?.company || 'Document'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 8px',
                      borderRadius: '999px',
                      border: '1px solid var(--border)',
                      color: 'var(--muted)',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}>{formatDate(document.created_at)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div style={emptyStateStyle}>No documents yet.</div>
        )}
      </div>
    </div>
  );
}
