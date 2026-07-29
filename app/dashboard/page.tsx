import type { CSSProperties } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { filterTrackedJobs } from '@/lib/jobFilters';
import ArrowIcon from '@/components/ui/ArrowIcon';
import PageHeader from '@/components/ui/PageHeader';
import FeedbackNudge from '@/components/FeedbackNudge';
import WordResumeNudge from '@/components/WordResumeNudge';
import { isDocxFile } from '@/lib/docx/fileType';

export const metadata = {
  title: 'Dashboard',
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
  job_id: string | null;
};

type DocumentRow = {
  id: string;
  type: 'tailored_resume' | 'cover_letter';
  created_at: string;
  job_id: string | null;
  jobs: { title: string | null; company: string | null } | null | Array<{ title: string | null; company: string | null }>;
};

type AtsScoreRow = {
  id: string;
  overall_score: number | null;
  scored_at: string;
  job_id: string | null;
  jobs: { title: string | null; company: string | null } | null | Array<{ title: string | null; company: string | null }>;
};

type ScoreRow = {
  overall_score: number | null;
  job_id: string | null;
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

function SectionEmpty({ title, sub, icon }: { title: string; sub: string; icon: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ textAlign: 'center', padding: '28px 16px' }}>
      <div style={{ width: '32px', height: '32px', margin: '0 auto 10px', background: 'var(--gold-dim)', borderRadius: 'var(--radius-sm)', display: 'grid', placeItems: 'center', color: 'var(--gold)' }}>
        {icon}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>{title}</div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--muted)' }}>{sub}</div>
    </div>
  );
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
    baseResumeResult,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, email, skills, target_roles')
      .eq('id', user.id)
      .single(),
    supabase
      .from('applications')
      .select('id, company, role, status, created_at, job_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('documents')
      .select('id, type, created_at, job_id, jobs(title, company)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('ats_scores')
      .select('id, overall_score, scored_at, job_id, jobs(title, company)')
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
      .select('overall_score, job_id')
      .eq('user_id', user.id),
    // Answered here rather than in the browser: the prompt below only applies
    // to a PDF resume, and asking on the server means it never flashes at the
    // Word users it does not apply to.
    supabase
      .from('resumes')
      .select('file_name, file_url')
      .eq('user_id', user.id)
      .eq('is_base', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
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

  // Only when there IS a resume and it is not Word. Someone with no resume is
  // already being told to upload one, and telling them which format first
  // would be answering a question they have not reached yet.
  const baseResumeName = baseResumeResult.data?.file_name ?? baseResumeResult.data?.file_url ?? '';
  const needsWordResume = Boolean(baseResumeName) && !isDocxFile(baseResumeName, '');
  const profileComplete = Boolean((profile?.skills?.length ?? 0) > 0 && (profile?.target_roles?.length ?? 0) > 0);

  const totalApplications = applications.length;
  const activeInterviews = applications.filter((application) => application.status === 'interviewing').length;
  const responseCount = applications.filter(
    (application) => application.status === 'interviewing' || application.status === 'offer'
  ).length;
  const responseRate =
    totalApplications > 0 ? `${((responseCount / totalApplications) * 100).toFixed(1)}%` : '-';
  const tailoringsThisWeek = weeklyTailoringsResult.count ?? 0;

  // Source of truth for "jobs the user has tracked": job_ids from the user's
  // non-deleted applications rows (applications query already filters deleted_at null).
  const trackedJobIds = new Set(
    applications
      .map((application) => application.job_id)
      .filter((jobId): jobId is string => jobId != null)
  );

  // Avg ATS only counts scores for tracked applications (same rule as the
  // /ats page) - tailoring runs that were never logged don't skew the stat.
  const avgAtsScoreValues = allAtsScores
    .filter((row) => row.job_id !== null && trackedJobIds.has(row.job_id))
    .map((row) => row.overall_score)
    .filter((score): score is number => score !== null);
  const avgAtsScore =
    avgAtsScoreValues.length > 0
      ? Math.round(avgAtsScoreValues.reduce((sum, score) => sum + score, 0) / avgAtsScoreValues.length)
      : null;

  // ATS Score History and Recent Documents join `jobs` independently, so restrict
  // them to entries whose job is a tracked application with a real title. Rows that
  // would otherwise fall back to a placeholder title are filtered out entirely.
  const trackedScores = filterTrackedJobs(
    atsScores.map((score) => ({
      ...score,
      jobId: score.job_id,
      title: firstJoinedJob(score.jobs)?.title ?? null,
    })),
    trackedJobIds
  );
  const trackedDocs = filterTrackedJobs(
    documents.map((document) => ({
      ...document,
      jobId: document.job_id,
      title: firstJoinedJob(document.jobs)?.title ?? null,
    })),
    trackedJobIds
  );

  const recentApplications = applications.slice(0, 5);
  const recentScores = trackedScores.slice(0, 3);
  const recentDocs = trackedDocs.slice(0, 5);

  const statCardStyle: CSSProperties = {
    background: 'var(--card-raised)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-md)',
    padding: '20px 24px',
  };

  const statValueStyle: CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontSize: '32px',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    color: 'var(--text)',
    lineHeight: 1,
  };

  const statLabelStyle: CSSProperties = {
    fontFamily: 'var(--font-body)',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--muted)',
    marginTop: '6px',
  };

  const sectionCardStyle: CSSProperties = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow-md)',
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
    fontFamily: 'var(--font-display)',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--muted)',
  };

  const viewAllStyle: CSSProperties = {
    fontSize: '12px',
    color: 'var(--muted)',
    textDecoration: 'none',
  };

  const listStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
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

      <PageHeader
        title={`Good ${bucket}, ${firstName}`}
        subtitle={
          totalApplications > 0
            ? `You have ${totalApplications} tracked applications, ${tailoringsThisWeek} tailorings this week, and ${profileComplete ? 'a complete profile' : 'room to improve your profile'}.`
            : 'Start with a tailored resume and a strong first application.'
        }
        action={enableFreemium ? (
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
        ) : undefined}
      />

      {/* A resume already uploaded as Word downloads as that exact document,
          so this is only worth saying to someone whose resume is a PDF. */}
      {needsWordResume && (
        <WordResumeNudge
          variant="card"
          needsWord
          style={{ marginTop: '16px', marginBottom: '16px' }}
        />
      )}

      <FeedbackNudge />

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
          <Link href="/tailor" className="btn-gold-hover" style={{
            background: 'var(--gold-dim)',
            color: 'var(--gold)',
            border: '1px solid var(--gold-border)',
            borderRadius: 'var(--radius)',
            padding: '8px 16px',
            fontSize: '13px',
            fontFamily: 'var(--font-display)',
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
            View all <ArrowIcon />
          </Link>
        </div>

        {recentApplications.length > 0 ? (
          <div style={listStyle}>
            {recentApplications.map((application) => (
              <div key={application.id} className="dash-row">
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
          <SectionEmpty
            title="No applications yet"
            sub="Log your first application on the Applications page."
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>}
          />
        )}
      </div>

      <div style={sectionCardStyle}>
        <div style={sectionHeaderStyle}>
          <div style={sectionTitleStyle}>ATS Score History</div>
          <Link href="/ats" style={viewAllStyle}>
            View all <ArrowIcon />
          </Link>
        </div>

        {recentScores.length > 0 ? (
          <div style={listStyle}>
            {recentScores.map((score) => {
              const numericScore = score.overall_score ?? 0;
              const job = firstJoinedJob(score.jobs);
              return (
                <div key={score.id} className="dash-row">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {score.title}
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
          <SectionEmpty
            title="No scores yet"
            sub="Tailor a resume to get your first ATS score."
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
          />
        )}
      </div>

      <div style={{ ...sectionCardStyle, marginBottom: 0 }}>
        <div style={sectionHeaderStyle}>
          <div style={sectionTitleStyle}>Recent Documents</div>
          <Link href="/documents" style={viewAllStyle}>
            View all <ArrowIcon />
          </Link>
        </div>

        {recentDocs.length > 0 ? (
          <div style={listStyle}>
            {recentDocs.map((document) => {
              const job = firstJoinedJob(document.jobs);
              return (
                <Link key={document.id} href={`/documents/${document.id}`} className="dash-row">
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
          <SectionEmpty
            title="No documents yet"
            sub="Tailored resumes and cover letters appear here."
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>}
          />
        )}
      </div>
    </div>
  );
}
