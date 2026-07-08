import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import EmptyState from '@/components/ui/EmptyState';
import ArrowIcon from '@/components/ui/ArrowIcon';
import PageHeader from '@/components/ui/PageHeader';
import { toAutoApplyList, autoApplyHref, type TrackedApplicationRow } from '@/lib/autoApply';

export const metadata = {
  title: 'Auto-apply - Vantage',
  description: 'Pre-fill job applications automatically',
};

// The Chrome Web Store listing goes live when the extension ships. Until then this
// points at the install guide so the button is never a dead end. Swap in the real
// store URL here once the extension is published.
const CHROME_EXTENSION_URL = '/docs/extension';

function formatDate(dateValue: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateValue));
}

const goldButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  background: 'var(--gold-dim)',
  border: '1px solid var(--gold-border)',
  color: 'var(--gold)',
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: '13px',
  borderRadius: 'var(--radius-sm)',
  padding: '8px 14px',
  whiteSpace: 'nowrap',
};

const ghostButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: '13px',
  borderRadius: 'var(--radius-sm)',
  padding: '8px 14px',
  whiteSpace: 'nowrap',
};

function CheckIcon(): React.ReactElement {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function SetupStep({
  step,
  done,
  title,
  description,
  action,
}: {
  step: number;
  done: boolean;
  title: string;
  description: React.ReactNode;
  action: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        gap: '14px',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        padding: '18px 0',
        borderTop: step === 1 ? 'none' : '1px solid var(--border-subtle)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: '28px',
          height: '28px',
          flexShrink: 0,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          fontWeight: 600,
          background: done ? 'rgba(34,197,94,0.12)' : 'var(--gold-dim)',
          color: done ? 'var(--score-green)' : 'var(--gold)',
          border: `1px solid ${done ? 'rgba(34,197,94,0.3)' : 'var(--gold-border)'}`,
        }}
      >
        {done ? <CheckIcon /> : step}
      </div>

      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '3px' }}>
          {title}
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.55 }}>
          {description}
        </div>
      </div>

      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{action}</div>
    </div>
  );
}

export default async function AutoApplyIndexPage(): Promise<React.ReactElement> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect('/login');
  }

  // Auto-apply lists every non-deleted application from the tracker, including
  // manually-logged entries whose job_id is null. In parallel, read whether a
  // connection code already exists so the setup checklist reflects real state.
  const [applicationsResult, profileResult] = await Promise.all([
    supabase
      .from('applications')
      .select('id, job_id, company, role, created_at')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('extension_token')
      .eq('id', user.id)
      .maybeSingle(),
  ]);

  const rows = (applicationsResult.data ?? []) as TrackedApplicationRow[];

  // Map through the shared helper: keeps every row with a real job title,
  // preserves manual (null job_id) rows, and never collapses rows by job_id.
  const applications = toAutoApplyList(rows);

  const hasConnectionCode = Boolean(
    (profileResult.data as { extension_token: string | null } | null)?.extension_token,
  );

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Auto-apply"
        subtitle="Set up the Chrome extension once, then let Vantage pre-fill any tracked application. You always review and submit - Vantage never submits for you."
      />

      {/* -- Set up once ---------------------------------------------------- */}
      <div className="ds-card" style={{ padding: '24px', marginBottom: '28px' }}>
        <div className="ds-section-label" style={{ marginBottom: '4px' }}>Set up once</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
          Connect the Chrome extension
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', margin: 0, lineHeight: 1.55, maxWidth: '540px' }}>
          Auto-apply fills forms through the Vantage browser extension. Get it set up and it stays connected to your account.
        </p>

        <div style={{ marginTop: '10px' }}>
          <SetupStep
            step={1}
            done={false}
            title="Install the Vantage Chrome extension"
            description={(
              <>
                Add it to Chrome, then pin the Vantage icon so it is one click away.
                <span style={{ display: 'block', marginTop: '4px', fontSize: '12px' }}>
                  Not on the Chrome Web Store yet - this opens the install guide for now.
                </span>
              </>
            )}
            action={(
              <Link href={CHROME_EXTENSION_URL} className="btn-gold-hover" style={goldButton}>
                Get the extension <ArrowIcon />
              </Link>
            )}
          />

          <SetupStep
            step={2}
            done={hasConnectionCode}
            title="Connect it with your connection code"
            description={
              hasConnectionCode
                ? 'Your account is linked. You can regenerate the code anytime from your profile.'
                : 'Generate a connection code on your profile, then paste it into the extension popup.'
            }
            action={(
              <Link href="/profile" style={hasConnectionCode ? ghostButton : goldButton} className={hasConnectionCode ? undefined : 'btn-gold-hover'}>
                {hasConnectionCode ? 'Manage code' : 'Get your code'} <ArrowIcon />
              </Link>
            )}
          />
        </div>
      </div>

      {/* -- Then apply ----------------------------------------------------- */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
        <div>
          <div className="ds-section-label" style={{ marginBottom: '4px' }}>Then apply</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
            Choose an application
          </div>
        </div>
        {applications.length > 0 && (
          <Link href="/tracker" style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            Manage tracker
          </Link>
        )}
      </div>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.55, maxWidth: '540px' }}>
        Pick a tracked application and Vantage opens it with your answers ready to fill.
      </p>

      {applications.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {applications.map((application) => (
            <Link key={application.id} href={autoApplyHref(application)} className="dash-card-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <div style={{ width: '36px', height: '36px', flexShrink: 0, background: 'var(--gold-dim)', borderRadius: 'var(--radius-sm)', display: 'grid', placeItems: 'center', color: 'var(--gold)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
                  </svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {application.company} · {application.role}
                  </div>
                  <div style={{ marginTop: '4px', fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Tracked {formatDate(application.created_at)}
                  </div>
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, color: 'var(--gold)', flexShrink: 0, whiteSpace: 'nowrap' }}>Start <ArrowIcon /></span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No tracked jobs to apply to yet"
          description="Auto-apply works from your application tracker. Add a job on the Tailor page and log the application - it will show up here."
          actionLabel="Open your tracker"
          actionHref="/tracker"
        />
      )}
    </div>
  );
}
