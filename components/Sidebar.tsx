'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard/profile', label: 'Profile' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/settings', label: 'Settings' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{ position: 'fixed', left: 0, top: 0, width: '220px', height: '100vh', background: 'var(--card)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>Vantage</div>
        <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--muted)' }}>Job application platform</div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', paddingTop: '4px' }}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          const linkStyle = {
            display: 'block',
            padding: active ? '10px 16px 10px 13px' : '10px 16px',
            fontSize: '13px',
            color: active ? 'var(--text)' : 'var(--muted)',
            textDecoration: 'none',
            transition: 'color 0.15s ease',
            borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent',
            boxSizing: 'border-box',
          } as const;

          return (
            <Link
              key={item.href}
              href={item.href}
              style={linkStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = active ? 'var(--text)' : 'var(--muted)';
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}