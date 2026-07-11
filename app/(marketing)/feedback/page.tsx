import FeedbackForm from './FeedbackForm';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Feedback',
  description: 'Report a bug, request a feature, ask a question, or get in touch - every message goes straight to the Vantage team.',
  alternates: { canonical: '/feedback' },
};

export default function FeedbackPage(): React.ReactElement {
  return (
    <div
      style={{
        maxWidth: '760px',
        margin: '0 auto',
        padding: '80px 24px',
      }}
    >
      <h1
        style={{
          fontSize: '2rem',
          fontWeight: 700,
          marginBottom: '10px',
          lineHeight: 1.2,
        }}
      >
        <span className="lph-metal">Help make Vantage better.</span>
      </h1>

      <p
        style={{
          fontSize: '0.98rem',
          color: 'var(--muted)',
          marginBottom: '40px',
          lineHeight: 1.6,
        }}
      >
        Report a bug, request a feature, ask a question, or just get in touch. Every message goes straight to the team.
      </p>

      <FeedbackForm />

      <p style={{ fontSize: '0.92rem', color: 'var(--muted)', marginTop: '32px' }}>
        Prefer email?{' '}
        <a href="mailto:ishvir.chopra@gmail.com" style={{ color: 'var(--text)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
          ishvir.chopra@gmail.com
        </a>
      </p>
    </div>
  );
}
