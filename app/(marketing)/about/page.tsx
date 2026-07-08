export const dynamic = 'force-static';

export const metadata = {
  title: 'About',
  description:
    'Vantage is an AI job application platform built by Ishvir Chopra for CS students and new grads - resume tailoring, ATS scoring, and auto-apply in one workspace.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <div
      style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '80px 24px',
      }}
    >
      <h1
        style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: '8px',
          lineHeight: 1.2,
        }}
      >
        About Vantage
      </h1>

      <p
        style={{
          fontSize: '0.88rem',
          color: 'var(--muted)',
          marginBottom: '56px',
        }}
      >
        Last updated: May 15, 2026
      </p>

      <section style={{ marginBottom: '40px' }}>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.8,
            fontSize: '0.98rem',
            marginBottom: '16px',
          }}
        >
          I built Vantage because I kept seeing the same thing over and over again: students applying to hundreds of jobs, getting almost no responses, and having no real way to tell why. In a survey of students, 75% reported getting less than a 5% response rate, and 37.5% had applied to over 100 jobs. That is the problem I wanted to work on.
        </p>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.8,
            fontSize: '0.98rem',
            marginBottom: '16px',
          }}
        >
          I am Ishvir Chopra, and I built Vantage from that reality. It is meant for the part of the job search that is repetitive, unclear, and frustrating, when you are trying to do everything right but still hearing nothing back.
        </p>
        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '32px 0 0' }} />
      </section>

      <section style={{ marginBottom: '40px' }}>
        <h2
          style={{
            fontSize: '1.2rem',
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: '16px',
            lineHeight: 1.3,
          }}
        >
          What Vantage actually is
        </h2>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.8,
            fontSize: '0.98rem',
            marginBottom: '16px',
          }}
        >
          Vantage is an AI tool that helps students apply more effectively. It helps tailor resumes, organize applications, and make the process less blind. It does not guarantee interviews or jobs, it does not fabricate qualifications, and it does not submit applications behind your back. You still review what gets sent.
        </p>
        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: 0 }} />
      </section>

      <section style={{ marginBottom: '40px' }}>
        <h2
          style={{
            fontSize: '1.2rem',
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: '16px',
            lineHeight: 1.3,
          }}
        >
          The company
        </h2>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.8,
            fontSize: '0.98rem',
            marginBottom: '16px',
          }}
        >
          Vantage is built by me, Ishvir Chopra. It is still an early product. I am building it in public and making changes based on real user feedback instead of pretending the first version was finished.
        </p>
        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: 0 }} />
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2
          style={{
            fontSize: '1.2rem',
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: '16px',
            lineHeight: 1.3,
          }}
        >
          Contact / connect
        </h2>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.8,
            fontSize: '0.98rem',
            marginBottom: '16px',
          }}
        >
          If you want to reach out, use the <a href="/contact" style={{ color: 'var(--text)', textDecoration: 'none' }}>contact page</a>. You can also find me on <a href="https://www.linkedin.com/in/ishvir-chopra-23758b2a8/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text)', textDecoration: 'none' }}>LinkedIn</a> or <a href="https://www.instagram.com/ishvirchopra/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text)', textDecoration: 'none' }}>Instagram</a>.
        </p>
        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: 0 }} />
      </section>

      <div>
        <div
          style={{
            color: 'var(--text)',
            fontSize: '0.98rem',
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          Ishvir Chopra, Founder
        </div>
        <div
          style={{
            color: 'var(--muted)',
            fontSize: '0.95rem',
            lineHeight: 1.5,
            marginTop: '4px',
          }}
        >
          Founder, Vantage
        </div>
      </div>
    </div>
  );
}
