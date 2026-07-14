import Link from 'next/link';
import type { Metadata } from 'next';
import Reveal from '@/components/marketing/Reveal';
import LandingParticles from '@/components/marketing/LandingParticles';
import Spotlight from '@/components/marketing/Spotlight';

export const dynamic = 'force-static';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: { absolute: 'Vantage' },
  description:
    'Vantage is the AI job application platform built by Ishvir Chopra for CS students and new grads, including the Waterloo recruiting crowd. Tailor your resume to every job description, see your ATS score before you apply, generate cover letters in your voice, and auto-fill applications with the Chrome extension.',
  keywords: [
    'Vantage',
    'Vantage resume builder',
    'Vantage AI job search',
    'AI resume tailor for students',
    'AI resume tailoring',
    'ATS score checker',
    'ATS resume optimization',
    'auto apply to jobs',
    'cover letter generator',
    'job application tracker',
    'CS student jobs',
    'new grad job search',
    'internship applications',
    'Waterloo co-op',
    'Ishvir Chopra',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Vantage',
    title: 'Vantage - AI Resume Tailoring, ATS Scoring & Auto-Apply for Students',
    description:
      'Applied to 100 jobs. Heard back from 1. Vantage tailors your resume to every job, scores it against ATS systems, and auto-fills applications.',
    images: [{ url: '/logo.png' }],
  },
  twitter: {
    card: 'summary',
    title: 'Vantage - AI Resume Tailoring, ATS Scoring & Auto-Apply for Students',
    description:
      'Applied to 100 jobs. Heard back from 1. Vantage tailors your resume to every job, scores it against ATS systems, and auto-fills applications.',
  },
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'Vantage',
      url: siteUrl,
      logo: `${siteUrl}/logo.png`,
      founder: {
        '@type': 'Person',
        name: 'Ishvir Chopra',
        url: 'https://ishvirschopra35.tech/',
        sameAs: [
          'https://github.com/Ishvirchopra35',
          'https://www.linkedin.com/in/ishvir-chopra-23758b2a8/',
          'https://www.instagram.com/ishvirchopra/',
          'https://www.youtube.com/@Ishvirchopra35',
        ],
      },
      sameAs: [
        'https://github.com/Ishvirchopra35',
        'https://www.linkedin.com/in/ishvir-chopra-23758b2a8/',
        'https://www.instagram.com/ishvirchopra/',
        'https://www.youtube.com/@Ishvirchopra35',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      name: 'Vantage',
      alternateName: 'Vantage AI job application platform',
      url: siteUrl,
      publisher: { '@id': `${siteUrl}/#organization` },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Vantage',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: siteUrl,
      description:
        'AI job application platform for students and new grads: resume tailoring to every job description, ATS scoring before you apply, cover letter generation, application tracking, and auto-filled application forms.',
      creator: { '@id': `${siteUrl}/#organization` },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Free tier with 10 resume tailorings per month; Pro at $8/month.',
      },
    },
  ],
};

function getFeatureIcon(featureName: string) {
  const iconProps = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 };

  switch (featureName) {
    case 'Resume tailoring':
      return <svg {...iconProps}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
    case 'ATS scoring':
      return <svg {...iconProps}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
    case 'Cover letters':
      return <svg {...iconProps}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
    case 'Application tracking':
      return <svg {...iconProps}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
    case 'Strategy feedback':
      return <svg {...iconProps}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
    case 'Networking assistant':
      return <svg {...iconProps}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case 'Interview prep':
      return <svg {...iconProps}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    case 'Auto-apply engine':
      return <svg {...iconProps}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>;
    default:
      return <svg {...iconProps}><path d="M2 10h16M10 2v16" /></svg>;
  }
}

function getStepIcon(step: number) {
  const iconProps = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 };

  switch (step) {
    case 1:
      return <svg {...iconProps}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case 2:
      return <svg {...iconProps}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
    default:
      return <svg {...iconProps}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
  }
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="2 8 6 12 14 3" />
    </svg>
  );
}

const PAIN_POINTS = [
  { quote: 'I applied to 50 jobs with the same resume and heard back from 2.', who: '- every senior in recruiting season' },
  { quote: 'I spent 45 minutes tailoring one resume and gave up by job 3.', who: '- anyone doing it by hand' },
  { quote: 'I have no idea why I keep getting rejected or what to fix.', who: '- the group chat, every week' },
];

type MockTone = 'gold' | 'green';

const SIDEBAR_ITEMS = ['Dashboard', 'Jobs', 'Tailor + ATS', 'Applications', 'Strategy', 'Networking', 'Interview Prep', 'Auto-apply'];

const SUBSCORES: { name: string; score: number }[] = [
  { name: 'Keywords', score: 92 },
  { name: 'Format', score: 84 },
  { name: 'Experience', score: 81 },
  { name: 'Skills', score: 88 },
];

const MISSING_KEYWORDS = ['GraphQL', 'CI/CD', 'Docker'];

const DIFF_ROWS: { before: string; after: React.ReactNode; badge: string; lit?: boolean }[] = [
  {
    before: 'Responsible for testing and fixing bugs in the mobile app.',
    after: <>Cut crash rate <b>31%</b> by adding <b>automated tests</b> across 4 releases of a React Native app.</>,
    badge: '+3 keywords',
    lit: true,
  },
  {
    before: 'Worked on the backend team on various services.',
    after: <>Built <b>REST APIs</b> in <b>Node.js</b> serving 40k daily requests with p95 under 120 ms.</>,
    badge: '+2 keywords',
  },
  {
    before: 'Helped with database stuff and queries.',
    after: <>Optimized <b>PostgreSQL</b> queries, cutting dashboard load time <b>38%</b>.</>,
    badge: '+2 keywords',
  },
];

const COVERAGE_ROWS: { kw: string; job: string; resume: string; ok: boolean }[] = [
  { kw: 'React Native', job: '6 mentions', resume: '4 mentions', ok: true },
  { kw: 'GraphQL', job: '3 mentions', resume: '0 mentions', ok: false },
  { kw: 'TypeScript', job: '5 mentions', resume: '5 mentions', ok: true },
];

const TRACK_ROWS: { co: string; logo: string; role: string; status: string; tone: MockTone }[] = [
  { co: 'Datadog', logo: 'D', role: 'New Grad Software Engineer', status: 'Interviewing', tone: 'green' },
  { co: 'Airbnb', logo: 'A', role: 'Frontend Engineer, University', status: 'Applied', tone: 'gold' },
  { co: 'Shopify', logo: 'S', role: 'Backend Developer Intern', status: 'Applied', tone: 'gold' },
];

const FORM_ROWS: { label: string; value: string }[] = [
  { label: 'Full name', value: 'Ishvir Chopra' },
  { label: 'Email', value: 'ischopra@uwaterloo.ca' },
  { label: 'Work authorization', value: 'Authorized to work in Canada' },
  { label: 'Why do you want to work here?', value: '[Drafted from your resume and this job post]' },
];

const SUPPORT_FEATURES = [
  { name: 'Cover letters', description: 'Written from your real experience.' },
  { name: 'ATS scoring', description: 'Scored against the bots before you apply.' },
  { name: 'Strategy feedback', description: 'See what works and what does not.' },
  { name: 'Networking assistant', description: 'Reach the right people at target companies.' },
  { name: 'Interview prep', description: 'Practice with AI feedback.' },
];

const STEPS = [
  { n: 1, title: 'Build your profile', description: 'Upload your resume once. Set your target roles and goals.' },
  { n: 2, title: 'Paste any job', description: 'Drop in a job URL or paste the description. We read it and tailor everything instantly.' },
  { n: 3, title: 'Apply and improve', description: 'Track results. The platform learns what works for you.' },
];

const FREE_FEATURES = [
  '10 resume tailorings per month',
  '10 cover letters per month',
  '20 auto-apply credits per month',
  'Track up to 150 applications',
  '2 strategy feedback reports per month',
  '15 networking message drafts per month',
  '5 interview prep sessions per month',
  'Email support',
];

const PRO_FEATURES = [
  'Unlimited resume tailoring',
  'Unlimited cover letters',
  'Unlimited auto-apply',
  'Unlimited application tracking',
  'Unlimited strategy feedback',
  'Unlimited networking assistant',
  'Unlimited interview preparation',
  'Priority support',
];

const CTA_GOLD = {
  display: 'inline-block',
  background: 'var(--gold-dim)',
  border: '1px solid rgba(201, 162, 39, 0.22)',
  color: 'var(--gold)',
  borderRadius: 'var(--radius)',
  padding: '12px 24px',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  fontWeight: 600,
  textDecoration: 'none' as const,
  textAlign: 'center' as const,
};

const CTA_OUTLINE = {
  display: 'inline-block',
  background: 'var(--card-raised)',
  border: 'none',
  color: 'var(--text)',
  borderRadius: 'var(--radius)',
  padding: '12px 24px',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  fontWeight: 600,
  textDecoration: 'none' as const,
  textAlign: 'center' as const,
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.07)',
};

const EYEBROW = {
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 10,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.12em',
  color: 'var(--muted)',
  marginBottom: 10,
};

const SECTION_H2 = {
  fontFamily: 'var(--font-display)',
  fontSize: 'clamp(24px, 3vw, 30px)',
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: 'var(--text)',
  margin: '0 0 24px',
};

const ICON_TILE = {
  width: 36,
  height: 36,
  background: 'var(--card-raised)',
  borderRadius: 'var(--radius-sm)',
  display: 'grid',
  placeItems: 'center' as const,
  marginBottom: 14,
  color: 'var(--muted)',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
};

function AppWindow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Spotlight className="lp-window">
      <div className="lp-window-bar">
        <span className="lp-window-dot" />
        <span className="lp-window-dot" />
        <span className="lp-window-dot" />
        <span className="lp-window-title">{title}</span>
      </div>
      <div className="lp-window-body">{children}</div>
    </Spotlight>
  );
}

function TrackerRow({
  co,
  logo,
  role,
  status,
  tone,
  ats,
}: {
  co: string;
  logo: string;
  role: string;
  status: string;
  tone: MockTone;
  ats?: number;
}) {
  return (
    <div className="lp-mock-row">
      <div className="lp-mock-left">
        <div className="lp-mock-logo">{logo}</div>
        <div style={{ minWidth: 0 }}>
          <div className="lp-mock-co">{co}</div>
          <div className="lp-mock-role">{role}</div>
        </div>
      </div>
      <div className="lp-mock-meta">
        <span className={tone === 'gold' ? 'lp-badge-gold' : 'lp-badge-green'}>{status}</span>
        {typeof ats === 'number' && (
          <div className="lp-ats">
            <span className="lp-ats-label">ATS</span>
            <span className="lp-ats-num">{ats}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      <div style={{ position: 'relative' }}>
        <LandingParticles />
        <div style={{ position: 'relative', zIndex: 1 }}>

      <section className="lph">
        <div className="lph-stage" aria-hidden="true">
          <div className="lph-mock">
            <div className="lph-side">
              <div className="lph-side-brand">Vantage</div>
              {SIDEBAR_ITEMS.map((item) => (
                <div key={item} className={`lph-side-item${item === 'Tailor + ATS' ? ' active' : ''}`}>{item}</div>
              ))}
            </div>

            <div className="lph-body">
              <div className="lph-pagehead">
                <div className="lph-pagehead-title">Tailor + ATS</div>
                <span className="lph-chip">Backend Developer Intern · Shopify</span>
              </div>

              <div className="lph-content">
                <div className="lph-card lph-scorecard">
                  <div className="lph-card-label">Overall ATS score</div>
                  <div className="lph-score-row">
                    <span className="lph-score-num">87</span>
                    <span className="lph-score-cap">Strong match</span>
                  </div>
                  <div className="lph-bars">
                    {SUBSCORES.map((s) => (
                      <div key={s.name}>
                        <div className="lph-bar-head">
                          <span>{s.name}</span>
                          <span>{s.score}</span>
                        </div>
                        <div className="lph-bar-track">
                          <div className="lph-bar-fill" style={{ width: `${s.score}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="lph-card-label" style={{ marginBottom: 0 }}>Missing keywords</div>
                  <div className="lph-kws" style={{ marginTop: 8, paddingTop: 0, borderTop: 'none' }}>
                    {MISSING_KEYWORDS.map((kw) => (
                      <span key={kw} className="lph-kw">{kw}</span>
                    ))}
                  </div>
                </div>

                <div className="lph-card">
                  <div className="lph-card-label">Bullet-by-bullet changes</div>
                  {DIFF_ROWS.map((row, i) => (
                    <div key={i} className="lph-diff-row">
                      <div className="lph-diff-before">{row.before}</div>
                      <div className={`lph-diff-after${row.lit ? ' lph-lit' : ''}`}>
                        {row.after}{' '}
                        <span className="lp-badge-gold" style={{ marginLeft: 6 }}>{row.badge}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lph-table">
                <div className="lph-trow lph-trow-head">
                  <span>Keyword</span>
                  <span>In job description</span>
                  <span>In your resume</span>
                  <span>Status</span>
                </div>
                {COVERAGE_ROWS.map((row) => (
                  <div key={row.kw} className="lph-trow">
                    <span className="co">{row.kw}</span>
                    <span>{row.job}</span>
                    <span>{row.resume}</span>
                    <span className={row.ok ? 'ok' : 'miss'}>{row.ok ? 'Covered' : 'Missing'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lph-beam" />
          <div className="lph-shade" />
        </div>

        <div className="lph-copy">
          <div className="lph-copy-inner">
            <div style={{ color: 'var(--muted)', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Built for recruiting season</div>

            <h1 className="lph-h1">
              <span className="lph-metal">Applied to 100 jobs.<br />Heard back from 1.</span><br />
              <span className="lph-metal-gold">There&apos;s a better way.</span>
            </h1>

            <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--muted)', maxWidth: 460, lineHeight: 1.6, margin: 0 }}>
              Vantage tailors your resume to every job, scores it against ATS systems, and tracks every application in one workspace.
            </p>

            <div style={{ marginTop: 30, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/signup" className="lp-glow-cta" style={CTA_GOLD}>Get started free</Link>
              <a href="#features" style={CTA_OUTLINE}>See how it works</a>
            </div>

            <p style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>Free during early access · No credit card required</p>
          </div>
        </div>
      </section>

      <Reveal as="section" id="sound-familiar" style={{ maxWidth: 1400, margin: '0 auto', padding: '54px clamp(24px, 4vw, 60px)' }} direction="up">
        <div style={EYEBROW}>Sound familiar?</div>
        <h2 style={SECTION_H2}>Applying more isn&apos;t working.</h2>

        <div className="lp-grid-3">
          {PAIN_POINTS.map((point, i) => (
            <Reveal key={point.who} index={i} direction="up">
              <figure className="glass-card lp-pain-card" style={{ margin: 0 }}>
                <blockquote style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.6, color: 'var(--text)' }}>
                  &ldquo;{point.quote}&rdquo;
                </blockquote>
                <figcaption style={{ marginTop: 12, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted)' }}>
                  {point.who}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </Reveal>

      <section id="features" className="lp-features">
        <Reveal className="lp-features-head" direction="up">
          <div style={EYEBROW}>Your unfair advantage</div>
          <h2 style={SECTION_H2}>Three things that change your odds</h2>
        </Reveal>

        <Reveal className="lp-feature-row" direction="up">
          <div className="lp-feature-copy">
            <div className="lp-feature-num">01 / Resume tailoring</div>
            <h3 className="lp-feature-title">Every bullet rewritten for the job in front of you</h3>
            <p className="lp-feature-desc">Paste a job description and Vantage rewrites each line to mirror it. Keywords woven in, nothing invented, and you see exactly what changed before you send it.</p>
          </div>
          <div className="lp-feature-visual">
            <Spotlight className="glass-card lp-stage" ariaHidden>
              <div className="lp-slip lp-slip-before">
                <div className="lp-diff-label" style={{ color: 'var(--muted)' }}>Before</div>
                <div className="lp-diff-before">Worked on the frontend team and helped build some internal web tools.</div>
              </div>
              <div className="lp-swap-chip">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
              </div>
              <div className="lp-slip lp-slip-after">
                <div className="lp-diff-label" style={{ color: 'var(--gold)' }}>After Vantage</div>
                <div className="lp-diff-after">Built <b>12 React components</b> for a high-traffic internal dashboard, cutting <b>page load time 40%</b>.</div>
                <div style={{ marginTop: 12 }}>
                  <span className="lp-badge-gold">+4 keywords matched</span>
                </div>
              </div>
            </Spotlight>
          </div>
        </Reveal>

        <Reveal className="lp-feature-row reverse" direction="up">
          <div className="lp-feature-copy">
            <div className="lp-feature-num">02 / Application tracking</div>
            <h3 className="lp-feature-title">Every application in one place, not five browser tabs</h3>
            <p className="lp-feature-desc">Statuses, follow-ups, and response rates update as you go. Know what you have heard back on and what still needs a nudge, without keeping a spreadsheet alive.</p>
          </div>
          <div className="lp-feature-visual">
            <AppWindow title="Vantage · Applications">
              <div className="lp-mock-statline">
                <div>
                  <div className="lp-mock-stat-num">24</div>
                  <div className="lp-mock-stat-label">Applied</div>
                </div>
                <div>
                  <div className="lp-mock-stat-num">6</div>
                  <div className="lp-mock-stat-label">Interviews</div>
                </div>
                <div>
                  <div className="lp-mock-stat-num">2</div>
                  <div className="lp-mock-stat-label">Offers</div>
                </div>
              </div>
              {TRACK_ROWS.map((r) => (
                <TrackerRow key={r.co} co={r.co} logo={r.logo} role={r.role} status={r.status} tone={r.tone} />
              ))}
            </AppWindow>
          </div>
        </Reveal>

        <Reveal className="lp-feature-row" direction="up">
          <div className="lp-feature-copy">
            <div className="lp-feature-num">03 / Auto-apply</div>
            <h3 className="lp-feature-title">The form fills itself. You review and submit.</h3>
            <p className="lp-feature-desc">The Chrome extension reads any application form and fills it from your profile. Vantage never hits submit, so the last look is always yours.</p>
          </div>
          <div className="lp-feature-visual">
            <Spotlight className="glass-card lp-stage" ariaHidden>
              <div className="lp-slip lp-mini-form">
                {FORM_ROWS.map((row) => (
                  <div key={row.label} className="lp-form-row">
                    <div style={{ minWidth: 0 }}>
                      <div className="lp-form-label">{row.label}</div>
                      <div className="lp-form-value">{row.value}</div>
                    </div>
                    <span className="lp-form-check">
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 8 6 12 14 3" /></svg>
                    </span>
                  </div>
                ))}
              </div>
              <div className="lp-ext-toast">
                <img src="/logo.png" alt="" width={26} height={26} className="lp-ext-toast-logo" />
                <div>
                  <div className="lp-ext-toast-title">Form filled from your profile</div>
                  <div className="lp-ext-toast-sub">Review and submit when ready.</div>
                </div>
              </div>
            </Spotlight>
          </div>
        </Reveal>
      </section>

      <section className="lp-support">
        <div className="lp-support-strip">
          {SUPPORT_FEATURES.map((feature, i) => (
            <Reveal key={feature.name} index={i} direction="up">
              <div>
                <span className="lp-support-icon">{getFeatureIcon(feature.name)}</span>
                <div className="lp-support-name">{feature.name}</div>
                <div className="lp-support-line">{feature.description}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal as="section" id="how-it-works" style={{ maxWidth: 1400, margin: '0 auto', padding: '54px clamp(24px, 4vw, 60px)' }} direction="up">
        <div style={EYEBROW}>How it works</div>
        <h2 style={SECTION_H2}>Upload once. Tailor every time.</h2>

        <div className="lp-grid-3">
          {STEPS.map((step) => (
            <Reveal key={step.n} index={step.n - 1} direction={step.n % 2 === 1 ? 'left' : 'right'}>
              <Spotlight className="glass-card" style={{ overflow: 'hidden', padding: 28 }}>
                <div aria-hidden="true" style={{ position: 'absolute', top: -18, right: 10, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 128, lineHeight: 1, paddingTop: 3, color: 'var(--text)', opacity: 0.06, pointerEvents: 'none', userSelect: 'none' }}>{step.n}</div>
                <div style={{ position: 'relative' }}>
                  <div style={ICON_TILE}>{getStepIcon(step.n)}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>{step.title}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>{step.description}</div>
                </div>
              </Spotlight>
            </Reveal>
          ))}
        </div>
      </Reveal>

      <Reveal as="section" id="pricing" style={{ maxWidth: 1400, margin: '0 auto', padding: '54px clamp(24px, 4vw, 60px)' }} direction="up">
        <div style={{ ...EYEBROW, textAlign: 'center' as const }}>Simple pricing</div>
        <h2 style={{ ...SECTION_H2, textAlign: 'center' as const }}>Free to start. Unlimited for $8.</h2>

        <div className="lp-pricing-grid">
          <Reveal index={0} direction="scale">
          <Spotlight className="glass-card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', minHeight: 24, fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 8 }}>Free</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 42, fontWeight: 800, marginBottom: 20, color: 'var(--text)' }}>$0 <span style={{ fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 400, color: 'var(--muted)' }}>/month</span></div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {FREE_FEATURES.map((feature, i) => (
                <li key={i} style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--score-green)', display: 'inline-flex', flexShrink: 0 }}><CheckIcon /></span>
                  {feature}
                </li>
              ))}
            </ul>

            <Link href="/signup" className="lp-glow-cta" style={{ ...CTA_GOLD, display: 'block', marginTop: 24 }}>Get started free</Link>
          </Spotlight>
          </Reveal>

          <Reveal index={1} direction="scale">
          <Spotlight className="glass-rim-strong lp-pro-card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 24, marginBottom: 8 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>Pro</div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', background: 'var(--gold-dim)', color: 'var(--gold)', borderRadius: '20px', padding: '2px 7px' }}>Most popular</span>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 42, fontWeight: 800, marginBottom: 20, color: 'var(--text)' }}>$8 <span style={{ fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 400, color: 'var(--muted)' }}>/month</span></div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PRO_FEATURES.map((feature, i) => (
                <li key={i} style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--gold)', display: 'inline-flex', flexShrink: 0 }}><CheckIcon /></span>
                  {feature}
                </li>
              ))}
            </ul>

            <Link href="/signup" className="lp-metal-btn" style={{ display: 'block', marginTop: 24, fontSize: 14, padding: '12px 24px' }}>Start 7-day free trial</Link>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted)', textAlign: 'center', margin: '10px 0 0' }}>
              7-day free trial, cancel any time · 7-day money-back guarantee
            </p>
          </Spotlight>
          </Reveal>
        </div>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginTop: 16 }}>Free for the first 50 users during early access</p>
      </Reveal>

      <Reveal as="section" style={{ maxWidth: 1400, margin: '0 auto', padding: '72px clamp(24px, 4vw, 60px) 88px' }} direction="up">
        <Spotlight className="glass-rim-strong lp-cta-special" style={{ padding: 'clamp(40px, 5.5vw, 68px)' }}>
          <div className="lp-cta-ghost" aria-hidden="true">Vantage</div>
          <div className="lp-cta-band-grid">
            <div>
              <div style={{ ...EYEBROW, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 2, background: 'var(--gold)', flexShrink: 0 }} />
                Your next application
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(30px, 4vw, 46px)', fontWeight: 800, letterSpacing: '-0.035em', lineHeight: 1.08, margin: '0 0 14px' }}>
                <span className="lph-metal lp-cta-metal-text">Stop sending the same resume to every job.</span>
              </h2>
              <p style={{ fontFamily: 'var(--font-body)', color: 'var(--muted)', fontSize: 16, lineHeight: 1.6, margin: '0 0 30px', maxWidth: 420 }}>
                Join students who are applying smarter.
              </p>
              <Link href="/signup" className="lp-metal-btn lp-btn-glint">Get started free</Link>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--muted)', margin: '14px 0 0' }}>
                Free during early access · No credit card required
              </p>
            </div>

            <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="lp-slip lp-slip-before">
                <div className="lp-diff-label" style={{ color: 'var(--muted)' }}>Before</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.6, color: 'var(--muted)', textDecoration: 'line-through', textDecorationColor: 'var(--muted)' }}>
                  Applied to 100 jobs. Heard back from 1.
                </div>
              </div>

              <div className="lp-swap-chip">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
              </div>

              <div className="lp-slip lp-slip-after">
                <div className="lp-diff-label" style={{ color: 'var(--gold)' }}>After Vantage</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, fontWeight: 600, lineHeight: 1.6, color: 'var(--text)' }}>
                  Applied to 12 jobs. Landed 4 interviews.
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: '20px', background: 'var(--gold-dim)', color: 'var(--gold)', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    ATS 84/100
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: '20px', background: 'rgba(34,197,94,0.12)', color: 'var(--score-green)', fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Interviewing
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Spotlight>
      </Reveal>
        </div>
      </div>
    </>
  );
}
