'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  {
    group: 'Getting started',
    items: [{ label: 'Getting started', href: '/docs/getting-started' }],
  },
  {
    group: 'Core features',
    items: [
      { label: 'Resume tailoring', href: '/docs/resume-tailoring' },
      { label: 'ATS scoring', href: '/docs/ats-scoring' },
      { label: 'Cover letters', href: '/docs/cover-letters' },
      { label: 'Application tracking', href: '/docs/application-tracking' },
    ],
  },
  {
    group: 'Advanced features',
    items: [
      { label: 'Auto-fill', href: '/docs/auto-fill' },
      { label: 'Strategy feedback', href: '/docs/strategy-feedback' },
      { label: 'Networking assistant', href: '/docs/networking' },
      { label: 'Interview prep', href: '/docs/interview-prep' },
    ],
  },
  {
    group: 'Account',
    items: [
      { label: 'Billing', href: '/docs/billing' },
      { label: 'Browser extension', href: '/docs/extension' },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap(g => g.items);

interface DocsLayoutProps {
  children: React.ReactNode;
}

export default function DocsLayout({ children }: DocsLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '60px 24px 80px' }}>
      {/* Mobile dropdown */}
      <div className="docs-mobile-nav">
        <select
          value={pathname}
          onChange={e => router.push(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text)',
            fontSize: '0.95rem',
            marginBottom: '32px',
            cursor: 'pointer',
          }}
        >
          {ALL_ITEMS.map(item => (
            <option key={item.href} value={item.href}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '64px', alignItems: 'flex-start' }}>
        {/* Desktop sidebar */}
        <nav className="docs-sidebar" style={{ flexShrink: 0, width: '220px' }}>
          {NAV.map(group => (
            <div key={group.group} style={{ marginBottom: '28px' }}>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: 'var(--muted)',
                  marginBottom: '10px',
                  paddingLeft: '12px',
                }}
              >
                {group.group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {group.items.map(item => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{
                        display: 'block',
                        padding: '6px 12px',
                        fontSize: '0.9rem',
                        color: active ? 'var(--text)' : 'var(--muted)',
                        fontWeight: active ? 500 : 400,
                        textDecoration: 'none',
                        borderLeft: active
                          ? '2px solid var(--accent)'
                          : '2px solid transparent',
                        marginLeft: '-2px',
                        borderRadius: '0 6px 6px 0',
                        background: active ? 'rgba(242,242,242,0.04)' : 'transparent',
                        transition: 'color 0.1s',
                      }}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Content */}
        <main style={{ flex: 1, minWidth: 0, maxWidth: '680px' }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .docs-mobile-nav { display: block !important; }
          .docs-sidebar { display: none !important; }
        }
        @media (min-width: 769px) {
          .docs-mobile-nav { display: none !important; }
          .docs-sidebar { display: block !important; }
        }
      `}</style>
    </div>
  );
}
