export const dynamic = 'force-static';

export const metadata = {
  title: 'Documentation -Vantage',
  description: 'Everything you need to get the most out of Vantage. Guides for resume tailoring, ATS scoring, cover letters, auto-fill, and more.',
};

const SECTIONS = [
  {
    label: 'Getting started',
    href: '/docs/getting-started',
    desc: 'Set up your account, upload your resume, and tailor your first application in minutes.',
  },
  {
    label: 'Resume tailoring',
    href: '/docs/resume-tailoring',
    desc: 'Reword and reposition your existing experience to match each job\'s ATS keywords.',
  },
  {
    label: 'ATS scoring',
    href: '/docs/ats-scoring',
    desc: 'Understand how automated screening systems evaluate your resume and how to score higher.',
  },
  {
    label: 'Cover letters',
    href: '/docs/cover-letters',
    desc: 'Generate keyword-driven cover letters that sound like you, not a template.',
  },
  {
    label: 'Application tracking',
    href: '/docs/application-tracking',
    desc: 'Log every application, track statuses, and measure your response rate over time.',
  },
  {
    label: 'Auto-fill',
    href: '/docs/auto-fill',
    desc: 'Fill out job application forms in seconds using the browser extension, console snippet, or answers panel.',
  },
  {
    label: 'Strategy feedback',
    href: '/docs/strategy-feedback',
    desc: 'Get AI analysis of your application patterns after 15 applications to optimize your approach.',
  },
  {
    label: 'Networking assistant',
    href: '/docs/networking',
    desc: 'Find contacts at target companies and generate personalized outreach messages.',
  },
  {
    label: 'Interview prep',
    href: '/docs/interview-prep',
    desc: 'Practice behavioral, technical, and company-specific questions with voice or text mode.',
  },
  {
    label: 'Billing',
    href: '/docs/billing',
    desc: 'Free vs Pro plan comparison, how to upgrade, and subscription management.',
  },
  {
    label: 'Browser extension',
    href: '/docs/extension',
    desc: 'Install the Chrome extension, connect your account, and troubleshoot common issues.',
  },
];

import Link from 'next/link';

export default function DocsHomePage() {
  return (
    <div
      style={{
        maxWidth: '1080px',
        margin: '0 auto',
        padding: '60px 24px 80px',
      }}
    >
      <h1
        style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: '8px',
          lineHeight: 1.2,
        }}
      >
        Documentation
      </h1>
      <p
        style={{
          fontSize: '1.05rem',
          color: 'var(--muted)',
          marginBottom: '48px',
          lineHeight: 1.6,
        }}
      >
        Everything you need to get the most out of Vantage.
      </p>

      <div
        style={{
          display: 'grid',
          gap: '16px',
        }}
        className="docs-home-grid"
      >
        {SECTIONS.map(section => (
          <Link
            key={section.href}
            href={section.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              padding: '20px 24px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              textDecoration: 'none',
              transition: 'border-color 0.15s',
            }}
            className="docs-home-card"
          >
            <div>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  color: 'var(--text)',
                  marginBottom: '4px',
                }}
              >
                {section.label}
              </div>
              <div
                style={{
                  fontSize: '0.88rem',
                  color: 'var(--muted)',
                  lineHeight: 1.5,
                }}
              >
                {section.desc}
              </div>
            </div>
            <span
              style={{
                color: 'var(--muted)',
                fontSize: '1.1rem',
                flexShrink: 0,
              }}
            >
              →
            </span>
          </Link>
        ))}
      </div>

      <style>{`
        .docs-home-grid {
          grid-template-columns: repeat(3, 1fr);
        }
        @media (max-width: 900px) {
          .docs-home-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 600px) {
          .docs-home-grid {
            grid-template-columns: 1fr;
          }
        }
        .docs-home-card:hover {
          border-color: var(--accent) !important;
        }
      `}</style>
    </div>
  );
}
