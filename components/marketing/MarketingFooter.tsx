import Link from 'next/link'

interface FooterLink {
  label: string
  href: string
}

interface FooterColumnProps {
  title: string
  links: FooterLink[]
}

function FooterColumn({ title, links }: FooterColumnProps) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'var(--muted)',
          marginBottom: 14,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {links.map(link => (
          <Link key={link.href} href={link.href} className="mkt-footer-link">
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function MarketingFooter() {
  return (
    <footer
      style={{
        background: 'var(--card)',
        borderTop: '1px solid var(--border)',
        padding: '48px 0 24px',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
        {/* Row 1: wordmark + link columns */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 48,
            marginBottom: 40,
            flexWrap: 'wrap',
          }}
        >
          {/* Wordmark + tagline */}
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              Vantage
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 220, lineHeight: 1.6 }}>
              Your unfair advantage in job searching.
            </div>
          </div>

          {/* Link columns */}
          <div style={{ display: 'flex', gap: 48, flexWrap: 'wrap' }}>
            <FooterColumn
              title="Product"
              links={[
                { label: 'Features', href: '/#features' },
                { label: 'Pricing', href: '/#pricing' },
              ]}
            />
            <FooterColumn
              title="Resources"
              links={[
                { label: 'Blog', href: '/blog' },
                { label: 'Changelog', href: '/changelog' },
              ]}
            />
            <FooterColumn
              title="Company"
              links={[
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
              ]}
            />
            <FooterColumn
              title="Legal"
              links={[
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms of Service', href: '/terms' },
              ]}
            />
          </div>
        </div>

        {/* Row 2: copyright + socials */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>© 2026 Vantage, Inc.</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                Made by Ishvir Chopra at the University of Waterloo
              </div>
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mkt-footer-link"
                style={{ fontSize: 12 }}
              >
                X
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mkt-footer-link"
                style={{ fontSize: 12 }}
              >
                LinkedIn
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mkt-footer-link"
                style={{ fontSize: 12 }}
              >
                Instagram
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
