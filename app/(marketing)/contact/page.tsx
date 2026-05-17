import ContactForm from '@/components/marketing/ContactForm';

export const metadata = {
  title: 'Contact - Vantage',
  description: 'Get in touch with the Vantage team.',
};

export default function ContactPage() {
  return (
    <div
      style={{
        maxWidth: '560px',
        margin: '0 auto',
        padding: '80px 24px',
      }}
    >
      <h1
        style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: '10px',
          lineHeight: 1.2,
        }}
      >
        Get in touch.
      </h1>

      <p
        style={{
          fontSize: '0.98rem',
          color: 'var(--muted)',
          marginBottom: '40px',
          lineHeight: 1.6,
        }}
      >
        Questions, feedback, bug reports, or just want to talk about your job search? Send a message
      </p>

      <ContactForm />

      <div
        style={{
          marginTop: '48px',
          paddingTop: '24px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <a
          href="mailto:ishvir.chopra@gmail.com"
          style={{
            color: 'var(--muted)',
            fontSize: '0.92rem',
            textDecoration: 'none',
          }}
        >
          ishvir.chopra@gmail.com
        </a>
        <span
          style={{
            color: 'var(--muted)',
            fontSize: '0.92rem',
          }}
        >
          Ontario, Canada
        </span>
      </div>
    </div>
  );
}
