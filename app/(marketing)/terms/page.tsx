import Link from "next/link";

// Terms of Service - plain-language, in-house version (2026-07-13).
// Facts here must track the product: refund policy, pricing, and feature
// behavior all mirror what the code actually does. A lawyer-reviewed
// replacement is planned; see docs/legal-dossier.md for the drafting brief.
export const dynamic = 'force-static';

export const metadata = {
  title: 'Terms of Service',
  description: 'Terms of service for Vantage, the AI job application platform.',
  alternates: { canonical: '/terms' },
};

const h2: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: 'var(--text)',
  marginBottom: '16px',
  lineHeight: 1.3,
};

const p: React.CSSProperties = {
  color: 'var(--muted)',
  lineHeight: 1.7,
  fontSize: '0.95rem',
  marginBottom: '12px',
};

const list: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const linkStyle: React.CSSProperties = {
  textDecoration: 'underline',
  color: 'var(--text)',
  textUnderlineOffset: 3,
};

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ ...p, marginBottom: 0, paddingLeft: '20px', position: 'relative' }}>
      <span style={{ position: 'absolute', left: 0, color: 'var(--text)' }}>•</span>
      {children}
    </li>
  );
}

export default function TermsPage() {
  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '80px 24px' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px', lineHeight: 1.2 }}>
        <span className="lph-metal">Terms of Service</span>
      </h1>
      <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginBottom: '56px' }}>
        Last updated: July 13, 2026
      </p>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>1. What Vantage is</h2>
        <p style={p}>
          Vantage is a job application platform that helps you tailor resumes, generate cover
          letters, score your resume against job postings, track applications, draft networking
          messages, practice interviews, and fill out application forms. It is provided by
          Vantage, operated by Ishvir Chopra. By creating an account or using Vantage, you agree
          to these terms.
        </p>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>2. Accounts</h2>
        <ul style={list}>
          <Bullet>You must be 16 or older to use Vantage.</Bullet>
          <Bullet>
            You can sign up with an email and password or with Google. Signing in with Google
            counts as accepting these terms and the Privacy Policy, exactly as checking the box
            on the signup form does.
          </Bullet>
          <Bullet>You are responsible for keeping your account credentials secure.</Bullet>
          <Bullet>You may have one account per person.</Bullet>
          <Bullet>We can suspend or terminate accounts that violate these terms.</Bullet>
        </ul>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>3. Acceptable use</h2>
        <p style={p}>You agree not to:</p>
        <ul style={list}>
          <Bullet>Submit false or fraudulent job applications.</Bullet>
          <Bullet>
            Misrepresent your qualifications on applications. Vantage never fabricates
            experience - any misrepresentation is your own addition.
          </Bullet>
          <Bullet>Reverse engineer, scrape, or copy the Vantage platform.</Bullet>
          <Bullet>
            Use the auto-fill features to submit applications without reviewing them. Vantage is
            designed for user-reviewed, user-submitted applications only, and none of its fill
            tools ever click submit for you.
          </Bullet>
          <Bullet>Share your account or connection codes with others.</Bullet>
          <Bullet>
            Use the Chrome extension in any automated or unattended way. It is designed for
            manual, user-initiated form filling only.
          </Bullet>
          <Bullet>
            Attempt to work around usage limits, or use the AI features (including the help chat)
            for anything other than your own job search.
          </Bullet>
        </ul>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>4. AI-generated content</h2>
        <p style={p}>
          Vantage uses AI to generate resume tailorings, cover letters, interview questions and
          feedback, outreach messages, application answers, strategy feedback, help-chat replies,
          and resume edits. AI-generated content is based on information you provide. We do not
          fabricate experience or qualifications.
        </p>
        <p style={p}>
          You are responsible for reviewing all AI-generated content before using it. AI output
          can be wrong. We do not guarantee the accuracy or effectiveness of AI-generated
          outputs, and getting a job is not guaranteed.
        </p>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>5. Experimental features</h2>
        <p style={p}>
          Features labelled experimental (currently Resume Studio) may change, break, or be
          removed without notice. Resume Studio keeps your working resume only in your browser
          tab - if you close the tab without downloading, that work is gone, and we cannot
          recover it.
        </p>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>6. Subscription and billing</h2>
        <ul style={list}>
          <Bullet>The Free tier is free forever with usage limits.</Bullet>
          <Bullet>The Pro tier is $8/month CAD, billed monthly via Stripe.</Bullet>
          <Bullet>
            You can cancel at any time from the billing page. Access continues until the end of
            the current billing period.
          </Bullet>
          <Bullet>
            Refunds: payments are non-refundable, including for partial months. When you cancel,
            you keep Pro access until the end of the current billing period.
          </Bullet>
          <Bullet>
            If you are on a free trial, you are not charged until the trial ends, and cancelling
            during the trial means you never pay.
          </Bullet>
          <Bullet>We reserve the right to change pricing with 30 days notice.</Bullet>
        </ul>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>7. Emails</h2>
        <p style={p}>
          We send transactional emails needed to run your account (for example password resets).
          Product-update emails are optional: we only send them if you opted in, every one of
          them contains an unsubscribe link that works without logging in, and you can turn them
          off in Settings at any time.
        </p>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>8. Data and privacy</h2>
        <p style={p}>
          Your use of Vantage is also governed by our{' '}
          <Link href="/privacy" style={linkStyle}>Privacy Policy</Link>. How we handle data
          obligations is described on the{' '}
          <Link href="/data-compliance" style={linkStyle}>Data Compliance</Link> page. You can
          wipe your data (keeping the account) or delete the account entirely from Settings.
        </p>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>9. Intellectual property</h2>
        <ul style={list}>
          <Bullet>The Vantage platform, codebase, and design are owned by Ishvir Chopra.</Bullet>
          <Bullet>
            Content you create using Vantage (your resume, cover letters, application data)
            belongs to you.
          </Bullet>
          <Bullet>
            You grant us a limited license to store and process your content to provide the
            service.
          </Bullet>
        </ul>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>10. Disclaimer</h2>
        <p style={p}>
          Vantage is provided &ldquo;as is.&rdquo; We do not guarantee uninterrupted service, perfect AI
          output quality, or employment outcomes. We are not liable for any decisions made based
          on Vantage outputs or for any damages resulting from your use of the platform.
        </p>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>11. Governing law</h2>
        <p style={p}>These terms are governed by the laws of Ontario, Canada.</p>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>12. Changes to these terms</h2>
        <p style={p}>
          If we make a material change to these terms, we will update the date at the top and
          announce it on the <Link href="/changelog" style={linkStyle}>changelog</Link>.
          Continuing to use Vantage after a change means you accept the new terms.
        </p>
      </section>

      <section>
        <h2 style={h2}>13. Contact</h2>
        <p style={p}>
          Questions about these terms? Contact us at ishvir.chopra@gmail.com or on the{' '}
          <Link href="/feedback" style={linkStyle}>feedback</Link> page.
        </p>
      </section>
    </div>
  );
}
