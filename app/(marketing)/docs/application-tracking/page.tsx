import DocsLayout from '@/components/marketing/DocsLayout';
import Link from 'next/link';
import ArrowIcon from '@/components/ui/ArrowIcon';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Application Tracking Â· Docs',
  description: 'Track your job applications, monitor statuses, and measure your response rate.',
  alternates: { canonical: '/docs/application-tracking' },
};

export default function ApplicationTrackingPage() {
  return (
    <DocsLayout>
      <div>
        <h1 style={heading}><span className="lph-metal">Application tracking</span></h1>
        <p style={summary}>Log every application, track statuses, and measure your response rate over time.</p>

        <section style={section}>
          <h2 style={h2}>How to use it</h2>
          <ol style={ol}>
            <li style={li}>After applying to a job, open the <strong style={strong}>Applications</strong> page in your dashboard.</li>
            <li style={li}>Click <strong style={strong}>Log application</strong> and enter the company, role, and job URL.</li>
            <li style={li}>The application starts with the status &quot;Applied.&quot;</li>
            <li style={li}>Update the status as you progress: Applied <ArrowIcon /> Interviewing <ArrowIcon /> Offer, or Applied <ArrowIcon /> Ghosted, or Interviewing <ArrowIcon /> Rejected.</li>
            <li style={li}>Add notes to any application for context (recruiter name, interview dates, etc.).</li>
          </ol>
        </section>

        <section style={section}>
          <h2 style={h2}>What to expect</h2>
          <p style={p}>The tracker shows all your applications in a sortable list with status indicators. Your response rate is calculated as (interviewing + offer) / total applications, giving you a real metric to track improvement over time.</p>
          <p style={p}>The status cycle has two paths:</p>
          <ul style={ul}>
            <li style={li}><strong style={strong}>Success path:</strong> Applied <ArrowIcon /> Interviewing <ArrowIcon /> Offer</li>
            <li style={li}><strong style={strong}>Failure paths:</strong> Applied <ArrowIcon /> Ghosted, or Interviewing <ArrowIcon /> Rejected</li>
          </ul>
          <p style={p}>As your application history grows, Vantage uses this data to improve AI outputs across all features - tailoring, cover letters, and strategy feedback all become more personalized.</p>
        </section>

        <section style={section}>
          <h2 style={h2}>Tips for best results</h2>
          <ul style={ul}>
            <li style={li}>Log every application, even the ones you are not optimistic about. A complete dataset produces better strategy feedback.</li>
            <li style={li}>Update statuses promptly. Accurate status data improves the AI&apos;s understanding of what is working for you.</li>
            <li style={li}>Use the notes field for recruiter names, interview dates, and follow-up reminders.</li>
          </ul>
        </section>

        <section style={section}>
          <h2 style={h2}>Common issues</h2>
          <div style={faq}>
            <p style={faqQ}>I hit the 150 application cap.</p>
            <p style={p}>The free tier allows up to 150 total tracked applications. This is not a monthly limit - it is a total cap. Upgrade to Pro for unlimited tracking, or delete old applications you no longer need.</p>
          </div>
          <div style={faq}>
            <p style={faqQ}>My response rate seems wrong.</p>
            <p style={p}>Response rate is calculated as (interviewing + offer) / total. Make sure you are updating statuses correctly - an application you heard back from should be moved to &quot;Interviewing,&quot; not left as &quot;Applied.&quot;</p>
          </div>
        </section>

        <p style={updated}>Last updated: July 8, 2026</p>
        <div style={nav}>
          <Link href="/docs/cover-letters" style={navLink}><ArrowIcon direction="left" /> Cover letters</Link>
          <Link href="/docs/auto-fill" style={navLink}>Auto-fill <ArrowIcon /></Link>
        </div>
      </div>
    </DocsLayout>
  );
}

const heading: React.CSSProperties = { fontSize: '2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '8px', lineHeight: 1.2 };
const summary: React.CSSProperties = { fontSize: '1.05rem', color: 'var(--muted)', marginBottom: '48px', lineHeight: 1.6 };
const section: React.CSSProperties = { marginBottom: '48px' };
const h2: React.CSSProperties = { fontSize: '1.2rem', fontWeight: 600, color: 'var(--text)', marginBottom: '16px', lineHeight: 1.3 };
const p: React.CSSProperties = { color: 'var(--text)', lineHeight: 1.7, marginBottom: '16px', fontSize: '0.95rem', opacity: 0.85 };
const ol: React.CSSProperties = { paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' };
const ul: React.CSSProperties = { listStyle: 'disc', paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' };
const li: React.CSSProperties = { color: 'var(--text)', lineHeight: 1.7, fontSize: '0.95rem', opacity: 0.85 };
const strong: React.CSSProperties = { fontWeight: 600, color: 'var(--text)' };
const faq: React.CSSProperties = { marginBottom: '24px' };
const faqQ: React.CSSProperties = { fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem', marginBottom: '6px' };
const updated: React.CSSProperties = { fontSize: '0.82rem', color: 'var(--muted)', marginTop: '64px', marginBottom: '24px' };
const nav: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '24px', borderTop: '1px solid var(--border)' };
const navLink: React.CSSProperties = { color: 'var(--accent)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 };
