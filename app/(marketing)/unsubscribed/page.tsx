import Link from 'next/link';

// Landing page for the unsubscribe link in marketing emails. Copy stays
// neutral on purpose: the API redirects here whether or not the token was
// valid, so this page must not claim to know the subscription state.
export const dynamic = 'force-static';

export const metadata = {
  title: 'Unsubscribed',
  description: 'You will no longer receive product update emails from Vantage.',
  robots: { index: false },
};

export default function UnsubscribedPage(): React.ReactElement {
  return (
    <div
      style={{
        maxWidth: '560px',
        margin: '0 auto',
        padding: '120px 24px',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontSize: '1.8rem',
          fontWeight: 700,
          marginBottom: '12px',
          lineHeight: 1.2,
        }}
      >
        <span className="lph-metal">You are unsubscribed.</span>
      </h1>
      <p style={{ fontSize: '0.98rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '28px' }}>
        You will no longer receive product update emails from Vantage.
        Changed your mind? You can turn them back on any time from Settings in the app.
      </p>
      <Link
        href="/"
        style={{ fontSize: '0.95rem', color: 'var(--text)', textDecoration: 'underline', textUnderlineOffset: 3 }}
      >
        Back to Vantage
      </Link>
    </div>
  );
}
