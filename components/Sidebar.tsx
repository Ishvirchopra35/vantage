'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export interface SidebarUserProfile {
  full_name: string | null;
  email: string | null;
}

export interface SidebarProps {
  profile?: SidebarUserProfile | null;
  remainingTailorings?: number | null;
  applicationCount?: number;
  plan?: 'free' | 'pro';
  enableFreemium?: boolean;
}

type NavItem = {
  href: string;
  label: string;
  locked?: boolean;
  comingSoon?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/tailor', label: 'Tailor + ATS' },
  { href: '/tracker', label: 'Applications' },
  { href: '/strategy', label: 'Strategy', comingSoon: true },
  { href: '/profile', label: 'Profile' },
  { href: '/settings', label: 'Settings' },
];

function getInitials(fullName: string | null | undefined): string {
  if (!fullName?.trim()) return 'V';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + second).toUpperCase() || 'V';
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect
        x="5"
        y="11"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SunMoonIcon({ theme }: { theme: 'dark' | 'light' }) {
  if (theme === 'dark') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M21 12.8A8.5 8.5 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const stored = window.localStorage.getItem('vantage-theme');
    const current = (stored === 'dark' || stored === 'light')
      ? stored
      : (document.documentElement.getAttribute('data-theme') as 'dark' | 'light' | null) ?? 'dark';
    setTheme(current);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    window.localStorage.setItem('vantage-theme', next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      style={{
        width: '30px',
        height: '30px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '8px',
        border: 'none',
        background: 'transparent',
        color: 'var(--muted)',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <SunMoonIcon theme={theme} />
    </button>
  );
}

function SignOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 17L15 12L10 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 3V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function Sidebar({
  profile = null,
  remainingTailorings = null,
  applicationCount = 0,
  plan = 'free',
  enableFreemium = false,
}: SidebarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = getInitials(profile?.full_name);
  const canSeeStrategy = applicationCount >= 15;

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [mobileOpen]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function NavLink({ item, mobile = false }: { item: NavItem; mobile?: boolean }) {
    const active = isActivePath(pathname, item.href);
    const locked = item.locked && !canSeeStrategy;
    const comingSoon = item.comingSoon ?? false;

    const baseStyle = {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      minHeight: '36px',
      padding: '0 16px',
      paddingLeft: active ? '13px' : '16px',
      borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
      textDecoration: 'none' as const,
      fontSize: '13px',
      lineHeight: 1,
    };

    if (comingSoon) {
      return (
        <span
          style={{
            ...baseStyle,
            color: 'var(--muted)',
            cursor: 'not-allowed',
            fontWeight: 400,
          }}
        >
          <span style={{ flex: 1 }}>{item.label}</span>
          <span
            style={{
              fontSize: '10px',
              color: 'var(--muted)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '1px 6px',
              marginLeft: '8px',
              whiteSpace: 'nowrap',
            }}
          >
            Soon
          </span>
        </span>
      );
    }

    return (
      <Link
        href={item.href}
        onClick={() => mobile && setMobileOpen(false)}
        aria-disabled={locked}
        style={{
          ...baseStyle,
          color: active ? 'var(--text)' : 'var(--muted)',
          fontWeight: active ? 600 : 400,
          cursor: locked ? 'default' : 'pointer',
          opacity: locked ? 0.72 : 1,
        }}
      >
        <span style={{ flex: 1 }}>{item.label}</span>
        {locked && <span style={{ display: 'inline-flex', color: 'currentColor' }}><LockIcon /></span>}
      </Link>
    );
  }

  const desktopSidebar = (
    <aside
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '220px',
        height: '100vh',
        background: 'var(--card)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)' }}>
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '17px',
            fontWeight: 700,
            color: 'var(--text)',
            textDecoration: 'none',
            letterSpacing: '0.01em',
          }}
        >
          <img src="/logo.png" width={24} height={24} style={{ borderRadius: '5px', objectFit: 'cover' }} alt="Vantage logo" />
          Vantage
        </Link>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', paddingTop: '12px', gap: '12px', flex: 1 }}>
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        {/* Launch 2 links kept in the DOM for later rollout
        <NavLink item={{ href: '/apply-prep', label: 'Apply Prep' }} />
        <NavLink item={{ href: '/networking', label: 'Networking' }} />
        <NavLink item={{ href: '/interview-prep', label: 'Interview Prep' }} />
        */}
      </nav>

      <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', fontSize: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '999px',
              background: 'var(--border)',
              color: 'var(--text)',
              display: 'grid',
              placeItems: 'center',
              fontSize: '11px',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.full_name || 'Your profile'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.email || 'No email available'}
            </div>
          </div>
        </div>

        {enableFreemium && remainingTailorings !== null && (
          <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--muted)' }}>
            {remainingTailorings} / 10 tailorings
          </div>
        )}

        {enableFreemium && plan === 'free' && (
          <button
            type="button"
            style={{
              marginTop: '12px',
              width: '100%',
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Upgrade to Pro
          </button>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleSignOut}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 0',
              borderRadius: '0',
              border: 'none',
              background: 'transparent',
              color: 'var(--muted)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <SignOutIcon />
            Sign out
          </button>
          <ThemeToggle />
        </div>

        <div style={{ borderTop: '1px solid var(--border)', marginTop: '8px', paddingTop: '12px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0 0 8px' }}>
            <Link href="/blog" className="sidebar-footer-link">Blog</Link>
            <Link href="/changelog" className="sidebar-footer-link">Changelog</Link>
            <Link href="/docs" className="sidebar-footer-link">Docs</Link>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0 0 4px' }}>
            <Link href="/about" className="sidebar-footer-link">About</Link>
            <Link href="/contact" className="sidebar-footer-link">Contact</Link>
            <Link href="/privacy" className="sidebar-footer-link">Privacy</Link>
            <Link href="/terms" className="sidebar-footer-link">Terms</Link>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {desktopSidebar}

      <div className="mobile-topbar">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          style={{
            width: '36px',
            height: '36px',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            background: 'transparent',
            color: 'var(--text)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <MenuIcon />
        </button>
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '17px',
            fontWeight: 700,
            color: 'var(--text)',
            textDecoration: 'none',
          }}
        >
          <img src="/logo.png" width={24} height={24} style={{ borderRadius: '5px', objectFit: 'cover' }} alt="Vantage logo" />
          Vantage
        </Link>
        <div style={{ width: '36px', height: '36px' }} />
      </div>

      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}

      <div className={`mobile-drawer ${mobileOpen ? 'open' : ''}`}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '17px',
              fontWeight: 700,
              color: 'var(--text)',
              textDecoration: 'none',
            }}
          >
            <img src="/logo.png" width={24} height={24} style={{ borderRadius: '5px', objectFit: 'cover' }} alt="Vantage logo" />
            Vantage
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            style={{
              width: '30px',
              height: '30px',
              border: '1px solid var(--border)',
              borderRadius: '999px',
              background: 'transparent',
              color: 'var(--text)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '18px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', paddingTop: '12px', gap: '12px', flex: 1 }}>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} mobile />
          ))}

          {/* Launch 2 links kept in the DOM for later rollout
          <NavLink item={{ href: '/apply-prep', label: 'Apply Prep' }} mobile />
          <NavLink item={{ href: '/networking', label: 'Networking' }} mobile />
          <NavLink item={{ href: '/interview-prep', label: 'Interview Prep' }} mobile />
          */}
        </nav>

        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '999px',
                background: 'var(--border)',
                color: 'var(--text)',
                display: 'grid',
                placeItems: 'center',
                fontSize: '11px',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.full_name || 'Your profile'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.email || 'No email available'}
              </div>
            </div>
          </div>

          {enableFreemium && remainingTailorings !== null && (
            <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--muted)' }}>
              {remainingTailorings} / 10 tailorings
            </div>
          )}

          {enableFreemium && plan === 'free' && (
            <button
              type="button"
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Upgrade to Pro
            </button>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleSignOut}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 0',
                borderRadius: '0',
                border: 'none',
                background: 'transparent',
                color: 'var(--muted)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <SignOutIcon />
              Sign out
            </button>
            <ThemeToggle />
          </div>

          <div style={{ borderTop: '1px solid var(--border)', marginTop: '8px', paddingTop: '12px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0 0 8px' }}>
              <Link href="/blog" className="sidebar-footer-link">Blog</Link>
              <Link href="/changelog" className="sidebar-footer-link">Changelog</Link>
              <Link href="/docs" className="sidebar-footer-link">Docs</Link>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0 0 4px' }}>
              <Link href="/about" className="sidebar-footer-link">About</Link>
              <Link href="/contact" className="sidebar-footer-link">Contact</Link>
              <Link href="/privacy" className="sidebar-footer-link">Privacy</Link>
              <Link href="/terms" className="sidebar-footer-link">Terms</Link>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .sidebar-footer-link {
          font-size: 11px;
          color: var(--muted);
          text-decoration: none;
        }
        .sidebar-footer-link:hover {
          color: var(--text);
        }

        .mobile-topbar {
          display: none;
        }

        .mobile-drawer {
          display: none;
        }

        .mobile-overlay {
          display: none;
        }

        @media (max-width: 767px) {
          .mobile-topbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 56px;
            padding: 0 16px;
            border-bottom: 1px solid var(--border);
            background: var(--card);
            display: flex;
            align-items: center;
            justify-content: space-between;
            z-index: 40;
          }

          .mobile-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.16);
            display: block;
            z-index: 45;
          }

          .mobile-drawer {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            width: 220px;
            background: var(--card);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            transform: translateX(-100%);
            transition: transform 0.2s ease;
            z-index: 50;
          }

          .mobile-drawer.open {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}