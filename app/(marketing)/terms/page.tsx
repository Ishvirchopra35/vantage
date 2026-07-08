import Link from "next/link";

export const dynamic = 'force-static';

export const metadata = {
  title: 'Terms of Service',
  description: 'Terms of service for Vantage, the AI job application platform.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <div
      style={{
        maxWidth: '680px',
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
        Terms of Service
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

      {/* 1. WHAT VANTAGE IS */}
      <section style={{ marginBottom: '48px' }}>
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '16px',
            lineHeight: 1.3,
          }}
        >
          1. What Vantage is
        </h2>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
            fontSize: '0.95rem',
          }}
        >
          Vantage is a job application platform that helps you tailor resumes, generate cover letters, track applications, and prepare for interviews. It is provided by Vantage, operated by Ishvir Chopra. By using Vantage, you agree to these terms.
        </p>
      </section>

      {/* 2. ACCOUNTS */}
      <section style={{ marginBottom: '48px' }}>
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '16px',
            lineHeight: 1.3,
          }}
        >
          2. Accounts
        </h2>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <li
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              paddingLeft: '20px',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--text)',
              }}
            >
              •
            </span>
            You must be 16 or older to use Vantage.
          </li>
          <li
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              paddingLeft: '20px',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--text)',
              }}
            >
              •
            </span>
            You are responsible for keeping your account credentials secure.
          </li>
          <li
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              paddingLeft: '20px',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--text)',
              }}
            >
              •
            </span>
            You may have one account per person.
          </li>
          <li
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              paddingLeft: '20px',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--text)',
              }}
            >
              •
            </span>
            We can suspend or terminate accounts that violate these terms.
          </li>
        </ul>
      </section>

      {/* 3. ACCEPTABLE USE */}
      <section style={{ marginBottom: '48px' }}>
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '16px',
            lineHeight: 1.3,
          }}
        >
          3. Acceptable use
        </h2>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
            marginBottom: '12px',
            fontSize: '0.95rem',
          }}
        >
          You agree not to:
        </p>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <li
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              paddingLeft: '20px',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--text)',
              }}
            >
              •
            </span>
            Submit false or fraudulent job applications.
          </li>
          <li
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              paddingLeft: '20px',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--text)',
              }}
            >
              •
            </span>
            Misrepresent your qualifications on applications. Vantage never fabricates experience - any misrepresentation is your own addition.
          </li>
          <li
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              paddingLeft: '20px',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--text)',
              }}
            >
              •
            </span>
            Reverse engineer, scrape, or copy the Vantage platform.
          </li>
          <li
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              paddingLeft: '20px',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--text)',
              }}
            >
              •
            </span>
            Use the auto-fill features to submit applications without reviewing them. Vantage is designed for user-reviewed, user-submitted applications only.
          </li>
          <li
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              paddingLeft: '20px',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--text)',
              }}
            >
              •
            </span>
            Share your account or API tokens with others.
          </li>
          <li
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              paddingLeft: '20px',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--text)',
              }}
            >
              •
            </span>
            Use the Chrome extension in any automated or unattended way. It is designed for manual, user-initiated form filling only.
          </li>
        </ul>
      </section>

      {/* 4. AI-GENERATED CONTENT */}
      <section style={{ marginBottom: '48px' }}>
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '16px',
            lineHeight: 1.3,
          }}
        >
          4. AI-generated content
        </h2>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
            marginBottom: '12px',
            fontSize: '0.95rem',
          }}
        >
          Vantage uses AI to generate resume tailorings, cover letters, interview questions, outreach messages, and application answers. AI-generated content is based on information you provide. We do not fabricate experience or qualifications.
        </p>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
            marginBottom: '12px',
            fontSize: '0.95rem',
          }}
        >
          You are responsible for reviewing all AI-generated content before using it. We do not guarantee the accuracy or effectiveness of AI-generated outputs. Getting a job is not guaranteed.
        </p>
      </section>

      {/* 5. SUBSCRIPTION AND BILLING */}
      <section style={{ marginBottom: '48px' }}>
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '16px',
            lineHeight: 1.3,
          }}
        >
          5. Subscription and billing
        </h2>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <li
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              paddingLeft: '20px',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--text)',
              }}
            >
              •
            </span>
            The Free tier is free forever with usage limits.
          </li>
          <li
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              paddingLeft: '20px',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--text)',
              }}
            >
              •
            </span>
            The Pro tier is $8/month USD, billed monthly via Stripe.
          </li>
          <li
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              paddingLeft: '20px',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--text)',
              }}
            >
              •
            </span>
            You can cancel at any time from the billing page. Access continues until the end of the current billing period.
          </li>
          <li
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              paddingLeft: '20px',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--text)',
              }}
            >
              •
            </span>
            No refunds for partial months.
          </li>
          <li
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              paddingLeft: '20px',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--text)',
              }}
            >
              •
            </span>
            We reserve the right to change pricing with 30 days notice.
          </li>
        </ul>
      </section>

      {/* 6. DATA AND PRIVACY */}
      <section style={{ marginBottom: '48px' }}>
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '16px',
            lineHeight: 1.3,
          }}
        >
          6. Data and privacy
        </h2>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
            fontSize: '0.95rem',
          }}
        >
          Your use of Vantage is also governed by our Privacy Policy at /privacy. By using Vantage you agree to both this terms of service and the privacy policy.
        </p>
      </section>

      {/* 7. INTELLECTUAL PROPERTY */}
      <section style={{ marginBottom: '48px' }}>
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '16px',
            lineHeight: 1.3,
          }}
        >
          7. Intellectual property
        </h2>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <li
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              paddingLeft: '20px',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--text)',
              }}
            >
              •
            </span>
            The Vantage platform, codebase, and design are owned by Ishvir Chopra.
          </li>
          <li
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              paddingLeft: '20px',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--text)',
              }}
            >
              •
            </span>
            Content you create using Vantage (your resume, cover letters, application data) belongs to you.
          </li>
          <li
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
              paddingLeft: '20px',
              position: 'relative',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 0,
                color: 'var(--text)',
              }}
            >
              •
            </span>
            You grant us a limited license to store and process your content to provide the service.
          </li>
        </ul>
      </section>

      {/* 8. DISCLAIMER */}
      <section style={{ marginBottom: '48px' }}>
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '16px',
            lineHeight: 1.3,
          }}
        >
          8. Disclaimer
        </h2>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
            fontSize: '0.95rem',
          }}
        >
          Vantage is provided "as is." We do not guarantee uninterrupted service, perfect AI output quality, or employment outcomes. We are not liable for any decisions made based on Vantage outputs or for any damages resulting from your use of the platform.
        </p>
      </section>

      {/* 9. GOVERNING LAW */}
      <section style={{ marginBottom: '48px' }}>
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '16px',
            lineHeight: 1.3,
          }}
        >
          9. Governing law
        </h2>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
            fontSize: '0.95rem',
          }}
        >
          These terms are governed by the laws of Ontario, Canada.
        </p>
      </section>

      {/* 10. CONTACT */}
      <section>
        <h2
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '16px',
            lineHeight: 1.3,
          }}
        >
          10. Contact
        </h2>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
            fontSize: '0.95rem',
          }}
        >
          Questions about these terms? Contact us at ishvir.chopra@gmail.com or on the <Link href="/contact" style={{ textDecoration: 'underline', color: 'var(--text)' }}>contact</Link> page.
        </p>
      </section>
    </div>
  );
}
