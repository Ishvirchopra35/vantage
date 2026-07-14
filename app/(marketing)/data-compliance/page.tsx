import Link from 'next/link';

// Data Compliance - plain-language description of how Vantage meets its
// data obligations (2026-07-13, in-house version). Claims here must stay
// honest: no certifications are asserted that we do not hold.
export const dynamic = 'force-static';

export const metadata = {
  title: 'Data Compliance',
  description: 'How Vantage handles data protection: safeguards, subprocessors, and your rights.',
  alternates: { canonical: '/data-compliance' },
};

const h2: React.CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: '16px',
  lineHeight: 1.3,
};

const p: React.CSSProperties = {
  color: 'var(--muted)',
  lineHeight: 1.7,
  fontSize: '0.95rem',
  marginBottom: '16px',
};

const list: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const linkStyle: React.CSSProperties = {
  textDecoration: 'underline',
  color: 'var(--text)',
  textUnderlineOffset: 3,
};

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ ...p, marginBottom: 0, paddingLeft: '20px', position: 'relative' }}>
      <span style={{ position: 'absolute', left: 0, color: 'var(--text)' }}>•</span>
      {children}
    </li>
  );
}

const SUBPROCESSORS: { name: string; role: string }[] = [
  { name: 'Supabase', role: 'Database, sign-in, and private file storage (servers in the United States)' },
  { name: 'Vercel', role: 'Website hosting and request logs' },
  { name: 'Google (Gemini API)', role: 'AI processing for every AI feature' },
  { name: 'Google (sign-in)', role: 'Optional "Continue with Google" authentication' },
  { name: 'Stripe', role: 'Payments - card data never touches Vantage servers' },
  { name: 'Resend', role: 'Opt-in product-update emails' },
  { name: 'Adzuna', role: 'Job discovery feed (receives role/location search terms)' },
  { name: 'Jina.ai', role: 'Reads job posting URLs you submit (URL only, no identity)' },
  { name: 'SerpApi', role: 'Networking contact search (public results)' },
];

export default function DataCompliancePage() {
  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '80px 24px' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px', lineHeight: 1.2 }}>
        <span className="lph-metal">Data Compliance</span>
      </h1>
      <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginBottom: '56px' }}>
        Last updated: July 13, 2026
      </p>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>Who is responsible</h2>
        <p style={{ ...p, marginBottom: 0 }}>
          Vantage is operated by Ishvir Chopra and built for Canadian users. We handle personal
          information under Canada&rsquo;s PIPEDA (Personal Information Protection and Electronic
          Documents Act). What we collect and why is described in the{' '}
          <Link href="/privacy" style={linkStyle}>Privacy Policy</Link>; this page describes how
          we protect it and how you stay in control.
        </p>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>How your data is protected</h2>
        <ul style={list}>
          <Bullet>
            Every database record is tied to your account with per-account access rules enforced
            by the database itself - one user can never read another user&rsquo;s rows.
          </Bullet>
          <Bullet>
            Resume files live in private storage: access rules only allow the uploading account
            to read its own files, and download links are short-lived.
          </Bullet>
          <Bullet>
            All traffic is encrypted in transit (HTTPS), and our hosting providers encrypt data
            at rest.
          </Bullet>
          <Bullet>
            Passwords are stored as secure hashes we cannot read; card data is held by Stripe
            only.
          </Bullet>
          <Bullet>
            Administrative access is limited to the operator, and admin actions never expose
            resume contents or documents.
          </Bullet>
          <Bullet>
            AI requests are sent server-side with only the text the feature needs - our AI keys
            and your data never pass through the browser of another user.
          </Bullet>
        </ul>
        <p style={{ ...p, marginTop: '20px', marginBottom: 0 }}>
          We do not currently hold formal certifications like SOC 2 - we are a small product and
          say so plainly. Our infrastructure providers (Supabase, Vercel, Stripe, Google)
          maintain their own audited compliance programs.
        </p>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>AI processing</h2>
        <ul style={list}>
          <Bullet>All AI features run on Google&rsquo;s Gemini API - a single provider.</Bullet>
          <Bullet>
            Your resume and application data are not used to train AI models - not by us, and
            not by Google under its paid API terms.
          </Bullet>
          <Bullet>
            The experimental Resume Studio never stores your resume server-side: the file is read
            once in memory and the working copy lives only in your browser tab.
          </Bullet>
        </ul>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>Subprocessors</h2>
        <p style={p}>These are the services that process data on our behalf:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {SUBPROCESSORS.map(s => (
            <div key={s.name}>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>
                {s.name}
              </div>
              <div style={{ fontSize: '0.95rem', color: 'var(--muted)', lineHeight: 1.6 }}>{s.role}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>Your controls</h2>
        <ul style={list}>
          <Bullet>
            <strong style={{ color: 'var(--text)' }}>Access and correction</strong> - most of
            your data is visible and editable in the app; email us for a copy of anything else.
          </Bullet>
          <Bullet>
            <strong style={{ color: 'var(--text)' }}>Reset my data</strong> (Settings) - wipes
            your resumes, jobs, documents, applications, and history while keeping the account.
          </Bullet>
          <Bullet>
            <strong style={{ color: 'var(--text)' }}>Delete account</strong> (Settings) - full
            erasure of the account and everything in it, completed within 30 days.
          </Bullet>
          <Bullet>
            <strong style={{ color: 'var(--text)' }}>Email opt-out</strong> - a Settings toggle
            plus a one-click unsubscribe link in every product-update email.
          </Bullet>
          <Bullet>
            <strong style={{ color: 'var(--text)' }}>Data export</strong> - not self-serve yet;
            email us and we will provide your data manually.
          </Bullet>
        </ul>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>If something goes wrong</h2>
        <p style={{ ...p, marginBottom: 0 }}>
          If a breach ever puts your personal information at real risk of significant harm, we
          will notify you and the Office of the Privacy Commissioner of Canada without undue
          delay, as PIPEDA requires, and tell you plainly what happened and what we are doing
          about it.
        </p>
      </section>

      <section>
        <h2 style={h2}>Questions</h2>
        <p style={{ ...p, marginBottom: 0 }}>
          Contact ishvir.chopra@gmail.com or use the{' '}
          <Link href="/feedback" style={linkStyle}>feedback</Link> page for anything about data
          handling, including access, correction, or export requests.
        </p>
      </section>
    </div>
  );
}
