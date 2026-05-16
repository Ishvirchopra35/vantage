import Link from 'next/link';

export const dynamic = 'force-static';

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

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="2 8 6 12 14 3" />
    </svg>
  );
}

const PAIN_POINTS = [
  'You apply to 50 jobs with the same resume and hear back from 2',
  'You spend 45 minutes tailoring one resume and run out of energy by job 3',
  'You have no idea why you\'re getting rejected or what to fix',
];

const FEATURES = [
  { name: 'Resume tailoring', description: 'Automatically rewritten for every job posting.' },
  { name: 'ATS scoring', description: 'See your score before you apply.' },
  { name: 'Cover letters', description: 'Generated from your real experience.' },
  { name: 'Application tracking', description: 'Every application logged and tracked.' },
  { name: 'Strategy feedback', description: 'Learn what\'s working and what isn\'t.' },
  { name: 'Networking assistant', description: 'Find the right people at target companies.' },
  { name: 'Interview prep', description: 'Practice with voice feedback.' },
  { name: 'Auto-apply engine', description: 'Pre-fills applications automatically.' },
];

const STEPS = [
  {
    n: 1,
    title: 'Build your profile',
    description: 'Upload your resume once. Set your target roles and goals.',
  },
  {
    n: 2,
    title: 'Paste any job',
    description: 'Drop in a job URL or paste the description. We parse it and tailor everything instantly.',
  },
  {
    n: 3,
    title: 'Apply and improve',
    description: 'Track results. The platform learns what works for you.',
  },
];

const FREE_FEATURES = [
  '10 resume tailorings/month',
  '10 cover letters/month',
  '20 auto-apply credits/month',
  'Track up to 150 applications',
  '2 strategy reports/month',
  'Email support',
];

const PRO_FEATURES = [
  'Everything in Free, unlimited',
  'Priority support',
  'Early access to new features',
];

export default function LandingPage() {
  return (
    <>
      {/* Background */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'radial-gradient(950px 420px at 15% -10%, rgba(255,255,255,0.1), transparent 55%), radial-gradient(850px 420px at 95% 0%, rgba(255,255,255,0.07), transparent 60%), #0a0a0a',
          zIndex: -1,
          pointerEvents: 'none',
        }}
      />

      {/* Hero Section */}
      <section
        style={{
          maxWidth: '1120px',
          margin: '0 auto',
          padding: '88px 24px 96px',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.09)',
            color: '#d6d6d6',
            borderRadius: '999px',
            padding: '7px 12px',
            fontSize: '0.83rem',
            marginBottom: '22px',
          }}
        >
          <div
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#f2f2f2',
              flexShrink: 0,
            }}
          />
          Built for students in recruiting season
        </div>

        <h1
          style={{
            fontSize: 'clamp(2.2rem, 6vw, 4.6rem)',
            lineHeight: 1.02,
            letterSpacing: '-0.04em',
            maxWidth: '840px',
            margin: '0 0 20px 0',
            color: '#fff',
          }}
        >
          Apply smarter.
          <br />
          Get hired faster.
        </h1>

        <p
          style={{
            marginTop: '20px',
            color: '#b9bcc4',
            maxWidth: '560px',
            fontSize: '1.1rem',
            lineHeight: 1.6,
          }}
        >
          Vantage tailors your resume to every job, scores it against ATS systems, and tracks every application in one workspace.
        </p>

        <div style={{ marginTop: '32px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link
            href="/signup"
            style={{
              background: '#f2f2f2',
              color: '#000',
              padding: '12px 20px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.95rem',
              textDecoration: 'none',
            }}
          >
            Get started free
          </Link>
          <a
            href="#how-it-works"
            style={{
              background: 'transparent',
              border: '1px solid #313131',
              color: '#e8e8e8',
              padding: '12px 20px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.95rem',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            See how it works
          </a>
        </div>

        <p style={{ marginTop: '14px', color: '#8b919d', fontSize: '0.88rem' }}>
          Built at the University of Waterloo · Free for early users · No credit card required
        </p>
      </section>

      {/* Pain Points Section */}
      <section
        id="sound-familiar"
        style={{
          maxWidth: '1120px',
          margin: '0 auto',
          padding: '90px 24px',
        }}
      >
        <div
          style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
            color: '#d8d8d8',
            marginBottom: '20px',
          }}
        >
          SOUND FAMILIAR?
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
          }}
        >
          {PAIN_POINTS.map((text, i) => (
            <div
              key={i}
              style={{
                background: '#111111',
                border: '1px solid #212121',
                borderRadius: '14px',
                padding: '22px',
                color: '#d1d5db',
                fontSize: '0.98rem',
                lineHeight: 1.65,
              }}
            >
              {text}
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        style={{
          maxWidth: '1120px',
          margin: '0 auto',
          padding: '90px 24px',
        }}
      >
        <div
          style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
            color: '#d8d8d8',
            marginBottom: '20px',
          }}
        >
          EVERYTHING YOU NEED TO GET HIRED
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
          }}
        >
          {FEATURES.map((feature, i) => (
            <div
              key={i}
              style={{
                background: '#111111',
                border: '1px solid #212121',
                borderRadius: '14px',
                padding: '22px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                  display: 'grid',
                  placeItems: 'center',
                  marginBottom: '14px',
                  color: '#9ca3af',
                }}
              >
                {getFeatureIcon(feature.name)}
              </div>
              <div
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  marginBottom: '6px',
                  color: '#fff',
                }}
              >
                {feature.name}
              </div>
              <div style={{ fontSize: '0.88rem', color: '#9ca3af', lineHeight: 1.6 }}>
                {feature.description}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section
        id="how-it-works"
        style={{
          maxWidth: '1120px',
          margin: '0 auto',
          padding: '90px 24px',
        }}
      >
        <div
          style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
            color: '#d8d8d8',
            marginBottom: '20px',
          }}
        >
          HOW IT WORKS
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
          }}
        >
          {STEPS.map((step, i) => (
            <div
              key={i}
              style={{
                background: '#111111',
                border: '1px solid #212121',
                borderRadius: '14px',
                padding: '28px',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: '1px solid #333',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '0.8rem',
                  color: '#9ca3af',
                  marginBottom: '16px',
                }}
              >
                {step.n}
              </div>
              <div
                style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: '#fff',
                }}
              >
                {step.title}
              </div>
              <div style={{ fontSize: '0.88rem', color: '#9ca3af', lineHeight: 1.6 }}>
                {step.description}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section
        id="pricing"
        style={{
          maxWidth: '1120px',
          margin: '0 auto',
          padding: '90px 24px',
        }}
      >
        <div
          style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.16em',
            color: '#d8d8d8',
            marginBottom: '20px',
            textAlign: 'center',
          }}
        >
          SIMPLE PRICING
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            maxWidth: '780px',
            margin: '0 auto',
            gap: '16px',
          }}
        >
          {/* Free Plan */}
          <div
            style={{
              background: '#111111',
              border: '1px solid #212121',
              borderRadius: '14px',
              padding: '28px',
            }}
          >
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#9ca3af',
                marginBottom: '8px',
              }}
            >
              Free
            </div>
            <div
              style={{
                fontSize: '2.4rem',
                fontWeight: 700,
                marginBottom: '20px',
                color: '#fff',
              }}
            >
              $0
              <span style={{ fontSize: '1rem', color: '#9ca3af' }}>/month</span>
            </div>

            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {FREE_FEATURES.map((feature, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: '0.9rem',
                    color: '#d1d5db',
                    paddingLeft: '20px',
                    position: 'relative',
                  }}
                >
                  <span style={{ color: '#22c55e', position: 'absolute', left: 0 }}>✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              style={{
                width: '100%',
                marginTop: '24px',
                display: 'block',
                background: '#f2f2f2',
                color: '#000',
                padding: '12px 20px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.95rem',
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              Get started free
            </Link>
          </div>

          {/* Pro Plan */}
          <div
            style={{
              background: '#111111',
              border: '1px solid #333',
              borderRadius: '14px',
              padding: '28px',
            }}
          >
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#9ca3af',
                marginBottom: '8px',
              }}
            >
              Pro
            </div>
            <div
              style={{
                fontSize: '2.4rem',
                fontWeight: 700,
                marginBottom: '20px',
                color: '#fff',
              }}
            >
              $8
              <span style={{ fontSize: '1rem', color: '#9ca3af' }}>/month</span>
            </div>

            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {PRO_FEATURES.map((feature, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: '0.9rem',
                    color: '#d1d5db',
                    paddingLeft: '20px',
                    position: 'relative',
                  }}
                >
                  <span style={{ color: '#22c55e', position: 'absolute', left: 0 }}>✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              style={{
                width: '100%',
                marginTop: '24px',
                display: 'block',
                background: '#f2f2f2',
                color: '#000',
                padding: '12px 20px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.95rem',
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              Get started free
            </Link>
          </div>
        </div>

        <p style={{ fontSize: '0.88rem', color: '#9ca3af', textAlign: 'center', marginTop: '16px' }}>
          Free for the first 50 users during early access
        </p>
      </section>

      {/* Final CTA Section */}
      <section
        style={{
          maxWidth: '1120px',
          margin: '0 auto',
          padding: '80px 24px',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            marginBottom: '12px',
            color: '#fff',
          }}
        >
          Stop sending the same resume to every job.
        </h2>
        <p style={{ color: '#9ca3af', fontSize: '1rem', marginBottom: '32px' }}>
          Join students who are applying smarter.
        </p>
        <Link
          href="/signup"
          style={{
            background: '#f2f2f2',
            color: '#000',
            padding: '12px 20px',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.95rem',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Get started free
        </Link>
      </section>

    </>
  );
}
