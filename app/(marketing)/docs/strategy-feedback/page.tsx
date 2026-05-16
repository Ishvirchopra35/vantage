import DocsLayout from '@/components/marketing/DocsLayout';
import Link from 'next/link';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Strategy Feedback - Vantage Docs',
  description: 'Get AI analysis of your application patterns to optimize your job search approach.',
};

export default function StrategyFeedbackPage() {
  return (
    <DocsLayout>
      <div>
        <h1 style={heading}>Strategy feedback</h1>
        <p style={summary}>Get AI analysis of your application patterns after 15 applications to identify what is working and what to change.</p>

        <section style={section}>
          <h2 style={h2}>How to use it</h2>
          <ol style={ol}>
            <li style={li}>Log at least <strong style={strong}>15 applications</strong> in your tracker with accurate status updates.</li>
            <li style={li}>Once you hit the threshold, the <strong style={strong}>Strategy</strong> page becomes available in your dashboard.</li>
            <li style={li}>Click <strong style={strong}>Generate feedback</strong> to run the analysis.</li>
            <li style={li}>Review the insights on role focus, keyword patterns, and response rate correlations.</li>
          </ol>
        </section>

        <section style={section}>
          <h2 style={h2}>What to expect</h2>
          <p style={p}>Strategy feedback analyzes your full application history and cross-references it with your ATS scores to find patterns. It looks at:</p>
          <ul style={ul}>
            <li style={li}><strong style={strong}>Response rate by role type</strong> - Which types of roles you are getting responses from and which you are not.</li>
            <li style={li}><strong style={strong}>ATS score correlation</strong> - Whether higher ATS scores are actually leading to more interviews for you.</li>
            <li style={li}><strong style={strong}>Common missing keywords</strong> - Keywords that appear frequently in your rejected applications but not in your resume.</li>
            <li style={li}><strong style={strong}>Focus roles</strong> - Roles where your data suggests you have the best chances, based on response rate and ATS performance.</li>
            <li style={li}><strong style={strong}>Avoid roles</strong> - Roles where you consistently get no response, suggesting a poor fit or a need to build additional skills first.</li>
          </ul>
          <p style={p}>The feedback refreshes automatically after every 5 new applications, so it becomes more accurate as your dataset grows.</p>
        </section>

        <section style={section}>
          <h2 style={h2}>Tips for best results</h2>
          <ul style={ul}>
            <li style={li}>Keep application statuses up to date. Strategy feedback is only as good as the data you provide.</li>
            <li style={li}>Log applications even when you get ghosted - the absence of a response is valuable data.</li>
            <li style={li}>Review the &quot;avoid roles&quot; section honestly. Continuing to apply to roles where you consistently get no response is inefficient.</li>
          </ul>
        </section>

        <section style={section}>
          <h2 style={h2}>Common issues</h2>
          <div style={faq}>
            <p style={faqQ}>Strategy feedback is not available yet.</p>
            <p style={p}>You need at least 15 logged applications with status updates before the analysis has enough data to be meaningful. Keep logging and it will unlock.</p>
          </div>
          <div style={faq}>
            <p style={faqQ}>The feedback does not seem accurate.</p>
            <p style={p}>Check that your application statuses are up to date. If most applications are still showing &quot;Applied&quot; without being moved to Ghosted, Interviewing, or Rejected, the AI lacks the signal it needs to identify patterns.</p>
          </div>
        </section>

        <p style={updated}>Last updated: May 15, 2026</p>
        <div style={nav}>
          <Link href="/docs/auto-fill" style={navLink}>← Auto-fill</Link>
          <Link href="/docs/networking" style={navLink}>Networking assistant →</Link>
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
