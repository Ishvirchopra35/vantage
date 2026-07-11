'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Blog', href: '/blog' },
  { label: 'Changelog', href: '/changelog' },
]

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

const CTA_GOLD = {
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  fontWeight: 600,
  background: 'var(--gold-dim)',
  border: '1px solid var(--gold)',
  color: 'var(--gold)',
  borderRadius: 'var(--radius)',
  padding: '8px 18px',
  textDecoration: 'none' as const,
  flexShrink: 0,
}

export default function MarketingNav() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  function isActive(href: string): boolean {
    if (href.startsWith('/#')) return false
    return pathname === href || pathname.startsWith(href + '/')
  }

  // Focus trap + Escape close
  useEffect(() => {
    if (!drawerOpen) return
    const el = drawerRef.current
    if (!el) return

    const focusable = el.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    first?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDrawerOpen(false)
        return
      }
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  return (
    <>
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          height: 76,
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--nav-border)',
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: '0 auto',
            padding: '0 clamp(24px, 4vw, 60px)',
            display: 'flex',
            alignItems: 'center',
            height: '100%',
          }}
        >
          {/* Wordmark */}
          <Link
            href="/"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 700, color: 'var(--text)', textDecoration: 'none', flexShrink: 0, letterSpacing: '-0.02em' }}
          >
            <img src="/logo.png" width={32} height={32} style={{ borderRadius: 'var(--radius-sm)', objectFit: 'cover' }} alt="Vantage logo" />
            Vantage
          </Link>

          {/* Center nav - hidden on mobile via CSS class */}
          <div className="mkt-nav-center" style={{ marginLeft: 32 }}>
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="mkt-nav-link"
                data-active={isActive(link.href) ? '' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* Right side - hidden on mobile */}
          <div className="mkt-nav-right">
            <Link
              href="/login"
              style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)', textDecoration: 'none' }}
            >
              Sign in
            </Link>
            <Link href="/signup" style={CTA_GOLD}>
              Get started
            </Link>
          </div>

          {/* Hamburger - visible on mobile only */}
          <button
            className="mkt-hamburger"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-nav-drawer"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 4 }}
          >
            <HamburgerIcon />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setDrawerOpen(false)}
        >
          <div
            id="mobile-nav-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              background: 'var(--card)',
              borderBottom: '1px solid var(--border)',
              padding: '20px 24px 28px',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <Link
                href="/"
                onClick={() => setDrawerOpen(false)}
                style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}
              >
                Vantage
              </Link>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation menu"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 4 }}
              >
                <CloseIcon />
              </button>
            </div>

            {/* Nav links */}
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setDrawerOpen(false)}
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: isActive(link.href) ? 'var(--text)' : 'var(--muted)',
                  textDecoration: 'none',
                  padding: '11px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {link.label}
              </Link>
            ))}

            {/* Auth */}
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Link
                href="/login"
                onClick={() => setDrawerOpen(false)}
                style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)', textDecoration: 'none' }}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                onClick={() => setDrawerOpen(false)}
                style={{ ...CTA_GOLD, display: 'block', textAlign: 'center', padding: '10px 18px' }}
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
