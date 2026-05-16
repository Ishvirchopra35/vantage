import Link from 'next/link'

export const dynamic = 'force-static'

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, marginTop: 2 }}
      aria-hidden="true"
    >
      <polyline points="2 7 5.5 10.5 12 3.5" />
    </svg>
  )
}

const PROBLEMS = [
  {
    title: 'You apply to 100 jobs with the same resume.',
    context: 'Most applicants never tailor. ATS systems filter them out before a human sees their name.',
  },
  {
    title: 'You spend 45 minutes on one application.',
    context: 'Writing cover letters, filling forms, answering questions. For every single job.',
  },
  {
    title: "You have no idea what's working.",
    context: 'No data. No patterns. No feedback. Just silence.',
  },
]

const FEATURES = [
  { name: 'Resume tailoring', description: 'Your resume rewritten for every job posting in under 60 seconds. Keyword-matched to the actual ATS.' },
  { name: 'ATS scoring', description: "See your score before you apply. Know exactly which keywords you're missing." },
  { name: 'Cover letters', description: 'Generated from your real experience. Sounds like you, not a template.' },
  { name: 'Application tracking', description: 'Every application logged. Response rate calculated. Status updated in one click.' },
  { name: 'Auto-apply', description: 'Pre-fills application forms automatically. You review and submit.' },
  { name: 'Strategy feedback', description: "After 15 applications, see which roles you're competitive for and what's holding you back." },
  { name: 'Networking assistant', description: 'Find the right people at target companies. Outreach messages written for you.' },
  { name: 'Interview prep', description: 'Practice with voice. AI listens, scores your answer, flags filler words.' },
]

const FREE_FEATURES = [
  '10 resume tailorings per month',
  '10 cover letters per month',
  '20 auto-apply credits per month',
  'Track up to 150 applications',
  '2 strategy feedback reports per month',
  '15 networking message drafts per month',
  '5 interview prep sessions per month',
  'Email support',
]

const PRO_FEATURES = [
  'Everything in Free, unlimited',
  'Priority support',
]

const STATS = [
  { stat: '75%', label: 'of students got less than 5% response rate before Vantage' },
  { stat: '87.5%', label: 'of students said auto-tailoring would change how they apply' },
  { stat: '60s', label: 'to tailor your resume to any job posting' },
]

const STEPS = [
  {
    n: 1,
    title: 'Upload your resume once.',
    text: 'Vantage learns your experience, skills, and target roles. One upload, used everywhere.',
  },
  {
    n: 2,
    title: 'Paste any job URL.',
    text: 'We parse the job description, extract every ATS keyword, and tailor your resume in under 60 seconds.',
  },
  {
    n: 3,
    title: 'Apply smarter, not harder.',
    text: 'Track every application. See your ATS score. Get strategy feedback after 15+ applications.',
  },
]

export default function LandingPage() {
  return (
    <>
      {/* 1. Hero */}
      <section className="lp-hero-section">
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <h1 className="lp-hero-title" style={{ marginBottom: 20 }}>
            Applied to 100 jobs.<br />
            Heard back from 3.<br />
            {"There's a better way."}
          </h1>
          <p className="lp-hero-sub" style={{ marginBottom: 36 }}>
            Vantage tailors your resume to every job posting, scores it against ATS systems, and tracks every application — in one workspace.
          </p>
          <div className="lp-cta-row" style={{ marginBottom: 28 }}>
            <Link
              href="/signup"
              style={{
                background: 'var(--accent)',
                color: 'var(--bg)',
                borderRadius: 10,
                padding: '12px 28px',
                fontSize: 15,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Get started free
            </Link>
            <Link
              href="#how-it-works"
              style={{
                background: 'transparent',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '12px 28px',
                fontSize: 15,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              See how it works
            </Link>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
            Built at the University of Waterloo · Used by students at [X] universities
          </p>
        </div>
      </section>

      {/* 2. Problem */}
      <section style={{ padding: '80px 24px', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 className="lp-section-heading" style={{ marginBottom: 40, textAlign: 'center' }}>
            The job search is broken.
          </h2>
          <div className="lp-problem-grid">
            {PROBLEMS.map((p, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: 24,
                }}
              >
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 10, lineHeight: 1.4 }}>
                  {p.title}
                </p>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65 }}>
                  {p.context}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. How it works */}
      <section
        id="how-it-works"
        style={{
          padding: '80px 24px',
          background: 'var(--card)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 className="lp-section-heading" style={{ marginBottom: 56, textAlign: 'center' }}>
            How Vantage works.
          </h2>
          <div className="lp-steps-row">
            {STEPS.map(step => (
              <div key={step.n} style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 16px' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text)',
                    margin: '0 auto 20px',
                  }}
                >
                  {step.n}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65 }}>
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Features */}
      <section id="features" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 className="lp-section-heading" style={{ marginBottom: 40, textAlign: 'center' }}>
            Everything you need to get hired.
          </h2>
          <div className="lp-features-grid">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: 20,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  {f.name}
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 }}>
                  {f.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Stats */}
      <section
        style={{
          padding: '80px 24px',
          background: 'var(--card)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 className="lp-section-heading" style={{ marginBottom: 48, textAlign: 'center' }}>
            {"The numbers don't lie."}
          </h2>
          <div className="lp-stats-grid">
            {STATS.map((s, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '36px 24px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 56,
                    fontWeight: 800,
                    color: 'var(--text)',
                    lineHeight: 1,
                    marginBottom: 14,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {s.stat}
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Pricing */}
      <section id="pricing" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 className="lp-section-heading" style={{ marginBottom: 40, textAlign: 'center' }}>
            Simple pricing.
          </h2>
          <div className="lp-pricing-grid">
            {/* Free */}
            <div
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 28,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Free</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>$0</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>/month</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28, flex: 1 }}>
                {FREE_FEATURES.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: 'var(--muted)' }}>
                    <CheckIcon />
                    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/signup"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  background: 'transparent',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '10px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Get started free
              </Link>
            </div>

            {/* Pro */}
            <div
              style={{
                background: 'var(--card)',
                border: '1px solid var(--pro-border)',
                borderRadius: 'var(--radius)',
                padding: 28,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Pro</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      color: 'var(--text)',
                      background: 'var(--border)',
                      borderRadius: 4,
                      padding: '2px 6px',
                    }}
                  >
                    POPULAR
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>$8</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>/month</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28, flex: 1 }}>
                {PRO_FEATURES.map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: 'var(--muted)' }}>
                    <CheckIcon />
                    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/signup"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  background: 'var(--accent)',
                  color: 'var(--bg)',
                  borderRadius: 10,
                  padding: '10px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Get started
              </Link>
            </div>
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 20 }}>
            No credit card required. Cancel anytime.
          </p>
        </div>
      </section>

      {/* 7. Final CTA */}
      <section
        style={{
          padding: '100px 24px',
          textAlign: 'center',
          background: 'var(--card)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <h2 className="lp-section-heading" style={{ marginBottom: 16 }}>
            Stop sending the same resume to every job.
          </h2>
          <p style={{ fontSize: 16, color: 'var(--muted)', marginBottom: 36, lineHeight: 1.6 }}>
            Join students who are applying smarter.
          </p>
          <Link
            href="/signup"
            style={{
              display: 'inline-block',
              background: 'var(--accent)',
              color: 'var(--bg)',
              borderRadius: 10,
              padding: '13px 32px',
              fontSize: 15,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Get started free
          </Link>
        </div>
      </section>
    </>
  )
}
