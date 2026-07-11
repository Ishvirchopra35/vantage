import Link from 'next/link'

interface FooterLink {
  label: string
  href: string
}

interface FooterColumnProps {
  title: string
  links: FooterLink[]
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58a2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="var(--bg)" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function FooterColumn({ title, links }: FooterColumnProps) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 11,
          fontWeight: 600,
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
        background: 'var(--bg)',
        borderTop: '1px solid var(--border-subtle)',
        fontFamily: 'var(--font-body)',
        padding: '48px 0 24px',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 clamp(24px, 4vw, 60px)' }}>
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
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
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
                { label: 'Docs', href: '/docs' },
                { label: 'Blog', href: '/blog' },
                { label: 'Changelog', href: '/changelog' },
              ]}
            />
            <FooterColumn
              title="Company"
              links={[
                { label: 'About', href: '/about' },
                { label: 'Feedback', href: '/feedback' },
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
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>© 2026 Vantage, Inc.</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>
                Made by Ishvir Chopra
              </div>
            </div>
            <div className="mkt-social-links">
              <a
                href="https://www.linkedin.com/in/ishvir-chopra-23758b2a8/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="mkt-social-link"
              >
                <LinkedInIcon />
              </a>
              <a
                href="https://www.instagram.com/ishvirchopra/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="mkt-social-link"
              >
                <InstagramIcon />
              </a>
              <a
                href="https://www.youtube.com/@Ishvirchopra35"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
                className="mkt-social-link"
              >
                <YouTubeIcon />
              </a>
              <a
                href="https://github.com/Ishvirchopra35"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="mkt-social-link"
              >
                <GitHubIcon />
              </a>
              <a
                href="https://ishvirschopra35.tech/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ishvir Chopra's portfolio"
                className="mkt-social-link"
              >
                <GlobeIcon />
              </a>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .mkt-social-links {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .mkt-social-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--muted);
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .mkt-social-link:hover {
          color: var(--text);
        }
      `}</style>
    </footer>
  )
}
