import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '24px',
      }}
    >
      <div style={{ fontSize: '80px', fontWeight: 700, color: 'var(--text)', lineHeight: 1, marginBottom: '8px' }}>
        404
      </div>

      <div style={{ fontSize: '18px', color: 'var(--muted)', marginBottom: '32px' }}>
        Page not found
      </div>

      <div style={{ width: '40px', height: '1px', background: 'var(--border)', margin: '0 auto 32px' }} />

      <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '32px' }}>
        This page doesn't exist or was moved.
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <Link
          href="/"
          style={{
            background: 'var(--accent)',
            color: 'var(--bg)',
            border: '1px solid var(--border)',
            padding: '10px 20px',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '14px',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Go home
        </Link>

        <Link
          href="/dashboard"
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            padding: '10px 20px',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '14px',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
