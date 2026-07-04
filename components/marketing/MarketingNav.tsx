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

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

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

export default function MarketingNav() {
  const pathname = usePathname()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem('vantage-theme') as 'dark' | 'light' | null
    const attr = document.documentElement.getAttribute('data-theme') as 'dark' | 'light' | null
    setTheme(stored ?? attr ?? 'dark')
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('vantage-theme', next)
  }

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

  const themeLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <>
      <nav
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          height: 76,
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--nav-border)',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            height: '100%',
          }}
        >
          {/* Wordmark */}
          <Link
            href="/"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', textDecoration: 'none', flexShrink: 0, letterSpacing: '-0.02em' }}
          >
            <img src="/logo.png" width={32} height={32} style={{ borderRadius: '6px', objectFit: 'cover' }} alt="Vantage logo" />
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
              style={{ fontSize: 14, color: 'var(--text)', textDecoration: 'none', opacity: 0.65 }}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              style={{
                fontSize: 14,
                fontWeight: 500,
                background: 'var(--accent)',
                color: 'var(--bg)',
                borderRadius: 10,
                padding: '8px 18px',
                textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              Get started
            </Link>
            <button
              onClick={toggleTheme}
              aria-label={themeLabel}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 8,
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text)',
                flexShrink: 0,
              }}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
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
                style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}
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
                  fontSize: 15,
                  color: 'var(--text)',
                  textDecoration: 'none',
                  padding: '11px 0',
                  borderBottom: '1px solid var(--border)',
                  opacity: isActive(link.href) ? 1 : 0.6,
                }}
              >
                {link.label}
              </Link>
            ))}

            {/* Auth + theme */}
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Link
                href="/login"
                onClick={() => setDrawerOpen(false)}
                style={{ fontSize: 14, color: 'var(--muted)', textDecoration: 'none' }}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                onClick={() => setDrawerOpen(false)}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  fontSize: 14,
                  fontWeight: 500,
                  background: 'var(--accent)',
                  color: 'var(--bg)',
                  borderRadius: 10,
                  padding: '10px 18px',
                  textDecoration: 'none',
                }}
              >
                Get started
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <button
                  onClick={toggleTheme}
                  aria-label={themeLabel}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    width: 34,
                    height: 34,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text)',
                  }}
                >
                  {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                </button>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
