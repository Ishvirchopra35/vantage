export const dynamic = 'force-static';

export const metadata = {
  title: 'Privacy Policy — Vantage',
  description: 'How we collect, use, and protect your data at Vantage.',
};

export default function PrivacyPage() {
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
        Privacy Policy
      </h1>

      <p
        style={{
          fontSize: '0.88rem',
          color: 'var(--muted)',
          marginBottom: '56px',
        }}
      >
        Last updated: May 17, 2026
      </p>

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
          What data we collect
        </h2>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
            marginBottom: '16px',
            fontSize: '0.95rem',
          }}
        >
          When you use Vantage, we collect data that falls into these categories:
        </p>

        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
            }}
          >
            Account data
          </h3>
          <p
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
            }}
          >
            When you sign up, we collect your email address, full name, university, and graduation year.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
            }}
          >
            Profile data
          </h3>
          <p
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
            }}
          >
            You provide information about yourself: your skills, target roles, years of experience, LinkedIn URL, and phone number. This data helps us personalize your experience and tailor content to your career goals.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
            }}
          >
            Resume data
          </h3>
          <p
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
            }}
          >
            You upload PDF files of your resume. We extract the plain text from these files and store both the original PDF and the extracted text. This data is used to generate tailored resumes, cover letters, and ATS scoring.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
            }}
          >
            Job data
          </h3>
          <p
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
            }}
          >
            When you paste a job URL or job description into Vantage, we store both. This data is used to generate tailored resumes, cover letters, and to calculate your ATS compatibility score.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
            }}
          >
            Application data
          </h3>
          <p
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
            }}
          >
            You log your applications in Vantage: the company name, role, application status, and any notes you add. This data helps you track your progress and identify patterns in what's working.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
            }}
          >
            Generated content
          </h3>
          <p
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
            }}
          >
            We store AI-generated outputs: tailored resumes, cover letters, answers to application questions, outreach messages, and interview session data. These are stored so you can view, edit, and reuse them.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
            }}
          >
            ATS scores and analysis
          </h3>
          <p
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
            }}
          >
            We calculate and store ATS compatibility scores and analysis for your resume against each job description. This data helps you understand how likely your resume is to pass automated screening.
          </p>
        </div>

        <div>
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
            }}
          >
            Usage events
          </h3>
          <p
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
            }}
          >
            We track which features you use and when you use them. This helps us understand how people use Vantage and where to focus improvements.
          </p>
        </div>
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
          Payment data
        </h2>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
            fontSize: '0.95rem',
          }}
        >
          Payment processing for Pro subscriptions is handled entirely by Stripe. We never see or store your card numbers. We only store your Stripe customer ID and subscription status. Stripe's privacy policy applies to payment information.
        </p>
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
          What we do NOT do with your data
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
            We do not sell your data to third parties.
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
            We do not use your resume or application data to train AI models.
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
            We do not share your data with employers or job boards.
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
            We do not read your email.
          </li>
        </ul>
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
          Third-party services
        </h2>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
            marginBottom: '16px',
            fontSize: '0.95rem',
          }}
        >
          We use these services to run Vantage:
        </p>

        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
            }}
          >
            Supabase
          </h3>
          <p
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
            }}
          >
            We use Supabase for our database and file storage. Supabase runs servers in the United States. Your data is stored in Supabase's infrastructure.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
            }}
          >
            Groq
          </h3>
          <p
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
            }}
          >
            We use Groq's API for AI inference. When you use resume tailoring, cover letter generation, ATS scoring, networking message generation, or other AI features, we send your resume text and job descriptions to Groq's API to generate outputs. Groq's privacy policy applies to this data.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
            }}
          >
            Cerebras
          </h3>
          <p
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
            }}
          >
            We use Cerebras's API for AI inference powering interview practice features. When you generate interview questions or submit a practice answer for assessment, we send relevant context (your profile, job details, and your answer) to Cerebras's API. Cerebras's privacy policy applies to this data.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
            }}
          >
            Stripe
          </h3>
          <p
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
            }}
          >
            Stripe handles all payment processing for Pro subscriptions. Your card information never reaches our servers.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
            }}
          >
            Vercel
          </h3>
          <p
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
            }}
          >
            We host Vantage on Vercel. Vercel's privacy policy applies to the infrastructure that serves the Vantage website.
          </p>
        </div>

        <div>
          <h3
            style={{
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: '8px',
            }}
          >
            Jina.ai
          </h3>
          <p
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
              fontSize: '0.95rem',
            }}
          >
            When you provide a job posting URL, we use Jina.ai to fetch and parse the content. Jina.ai's privacy policy applies to URLs you submit.
          </p>
        </div>
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
          The Chrome extension
        </h2>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
            marginBottom: '16px',
            fontSize: '0.95rem',
          }}
        >
          Our Chrome extension helps you fill out job application forms quickly.
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
            The extension reads the content of job application pages you visit when you click the "Fill this form" button.
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
            It fetches your application kit (your name, email, resume content, and generated answers) from the Vantage API and uses it to fill form fields locally in your browser.
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
            The extension does not track your browsing history.
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
            The extension only activates when you explicitly click the Fill button.
          </li>
        </ul>
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
          Data retention and deletion
        </h2>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
            marginBottom: '16px',
            fontSize: '0.95rem',
          }}
        >
          Your data is retained as long as your account is active. You can delete your account at any time from your Profile page. This deletes all your data including resumes, applications, and generated documents. Deleted data is removed from our systems within 30 days.
        </p>
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
          Your rights
        </h2>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
            marginBottom: '16px',
            fontSize: '0.95rem',
          }}
        >
          Vantage is built for Canadian users, and we comply with Canada's PIPEDA (Personal Information Protection and Electronic Documents Act). You have the right to:
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
            Access your data
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
            Correct inaccurate data
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
            Withdraw consent and delete your account
          </li>
        </ul>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
            marginTop: '20px',
            fontSize: '0.95rem',
          }}
        >
          If you have questions about your data or want to exercise these rights, contact us at ishvir.chopra@gmail.com
        </p>
      </section>

      <section>
        <p
          style={{
            color: 'var(--muted)',
            lineHeight: 1.7,
            fontSize: '0.88rem',
            fontStyle: 'italic',
          }}
        >
          This privacy policy is in plain English because we believe you should understand how we use your data. If you have questions or concerns, please reach out.
        </p>
      </section>
    </div>
  );
}
