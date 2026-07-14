import Link from 'next/link';

// Privacy Policy - plain-language, in-house version (2026-07-13).
// The inventory here mirrors docs/legal-dossier.md; when either changes,
// change both. A lawyer-reviewed replacement is planned.
export const dynamic = 'force-static';

export const metadata = {
  title: 'Privacy Policy',
  description: 'How Vantage collects, uses, and protects your data.',
  alternates: { canonical: '/privacy' },
};

const h2: React.CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: '16px',
  lineHeight: 1.3,
};

const h3: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: '8px',
};

const p: React.CSSProperties = {
  color: 'var(--muted)',
  lineHeight: 1.7,
  fontSize: '0.95rem',
  marginBottom: '16px',
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

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={h3}>{title}</h3>
      <p style={{ ...p, marginBottom: 0 }}>{children}</p>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '80px 24px' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px', lineHeight: 1.2 }}>
        <span className="lph-metal">Privacy Policy</span>
      </h1>
      <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginBottom: '56px' }}>
        Last updated: July 13, 2026
      </p>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>What data we collect</h2>
        <p style={p}>When you use Vantage, we collect data that falls into these categories:</p>

        <Item title="Account data">
          When you sign up with email, we collect your email address, full name, and password
          (stored as a secure hash we cannot read). When you sign in with Google, we receive
          your name and email address from Google instead. We also record whether you opted in
          to product-update emails.
        </Item>

        <Item title="Profile data">
          You provide information about yourself: your university, graduation year, skills,
          target roles, years of experience, work experience, projects, phone number, and
          LinkedIn, GitHub, and portfolio links. This data personalizes every AI output.
        </Item>

        <Item title="Resume data">
          You upload PDF or Word files of your resume. We extract the text and store the
          original file, the extracted text, and a formatted version. This powers tailoring,
          cover letters, and compatibility scoring (against the software companies use to screen
          resumes). Files live in private storage only your account can access.
        </Item>

        <Item title="Job and application data">
          Job postings you paste or save, and the applications you track: company, role, status,
          dates, and your notes.
        </Item>

        <Item title="Generated content">
          AI outputs are stored so you can view, edit, and reuse them: tailored resumes, cover
          letters, application answers, outreach messages, interview questions and feedback, and
          strategy feedback. Compatibility scores and their breakdowns are stored too.
        </Item>

        <Item title="Networking contacts">
          When you draft outreach, you provide details about other people: a contact&rsquo;s name,
          title, company, and LinkedIn URL, plus the message itself. This data stays in your
          account and is only used to write and track your messages. You are responsible for
          using it respectfully.
        </Item>

        <Item title="Interview practice">
          Your typed or spoken practice answers and the AI&rsquo;s feedback. Voice input uses your
          browser&rsquo;s built-in speech recognition, so the audio is processed by your browser
          vendor&rsquo;s speech service; we only ever receive the resulting text.
        </Item>

        <Item title="Help chat">
          Messages you send to the in-app help chat are processed by our AI provider to answer
          them. The conversation lives in your browser and is not saved to your account.
        </Item>

        <Item title="Usage data">
          Which features you use and when, plus technical logs (which API was called, how long
          it took). This drives usage limits and tells us where to improve the product.
        </Item>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>Payment data</h2>
        <p style={{ ...p, marginBottom: 0 }}>
          Payment processing for Pro subscriptions is handled entirely by Stripe. We never see or
          store your card numbers - only your Stripe customer ID and subscription status.
          Stripe&rsquo;s privacy policy applies to payment information.
        </p>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>What we do NOT do with your data</h2>
        <ul style={list}>
          <Bullet>We do not sell your data to third parties.</Bullet>
          <Bullet>We do not use your resume or application data to train AI models.</Bullet>
          <Bullet>We do not share your data with employers or job boards.</Bullet>
          <Bullet>We do not read your email.</Bullet>
          <Bullet>We do not use advertising cookies or third-party analytics trackers.</Bullet>
        </ul>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>Third-party services</h2>
        <p style={p}>We use these services to run Vantage:</p>

        <Item title="Supabase">
          Our database, sign-in system, and file storage. Supabase runs servers in the United
          States. Your data is stored in Supabase&rsquo;s infrastructure with per-account access
          rules.
        </Item>

        <Item title="Google (Gemini)">
          All AI features run on Google&rsquo;s Gemini API. When you use tailoring, cover letters,
          scoring, outreach, interview practice, strategy feedback, the help chat, or Resume
          Studio, the relevant text (your resume, the job posting, your question) is sent to
          Google to generate the output. Google&rsquo;s API terms apply; per Google&rsquo;s
          policy for paid API use, this data is not used to train their models.
        </Item>

        <Item title="Google (sign-in)">
          If you choose &ldquo;Continue with Google&rdquo;, Google shares your name and email with us to
          create your session. We never see your Google password.
        </Item>

        <Item title="Stripe">
          All payment processing. Your card information never reaches our servers.
        </Item>

        <Item title="Resend">
          Sends our product-update emails (only if you opted in). Resend processes your email
          address and delivery events.
        </Item>

        <Item title="Adzuna">
          Powers the job discovery feed. Your role and location search terms are sent to Adzuna
          to fetch matching postings.
        </Item>

        <Item title="Jina.ai">
          When you provide a job posting or application form URL, we use Jina.ai to load and
          read the page text. Only the URL is sent, never your identity.
        </Item>

        <Item title="SerpApi">
          Powers the networking contact search. The company and role you search for are sent to
          SerpApi, which returns publicly available results.
        </Item>

        <Item title="Vercel">
          Hosts the Vantage website and processes request traffic and server logs.
        </Item>

        <Item title="Feedback">
          Messages submitted on the feedback page (and the email you optionally include) are
          forwarded to a private spreadsheet we review.
        </Item>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>The Chrome extension</h2>
        <p style={p}>Our Chrome extension helps you fill out job application forms quickly.</p>
        <ul style={list}>
          <Bullet>
            The extension reads the content of a job application page only when you click the
            fill button on that page.
          </Bullet>
          <Bullet>
            It fetches your application kit (your name, email, resume content, and generated
            answers) from the Vantage API using your connection code, and fills form fields
            locally in your browser.
          </Bullet>
          <Bullet>It does not track your browsing history and does not run in the background.</Bullet>
          <Bullet>It never submits a form - you always review and submit yourself.</Bullet>
        </ul>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>Cookies and browser storage</h2>
        <ul style={list}>
          <Bullet>Sign-in cookies from Supabase - essential, they keep you logged in.</Bullet>
          <Bullet>
            Local storage for small preferences: your theme choice and dismissed notices.
          </Bullet>
          <Bullet>
            Session storage for Resume Studio&rsquo;s working copy - it lives only in the open tab
            and is gone when the tab closes; nothing from Resume Studio is saved to our servers.
          </Bullet>
          <Bullet>No advertising or third-party analytics cookies.</Bullet>
        </ul>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>Product-update emails</h2>
        <p style={{ ...p, marginBottom: 0 }}>
          We only send product-update emails if you opted in (the signup checkbox or the Settings
          toggle). Every one contains a one-click unsubscribe link that works without logging in,
          and the toggle in Settings turns them off any time. Transactional emails needed to run
          your account (like password resets) are separate and always sent.
        </p>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>Data retention and deletion</h2>
        <p style={p}>
          Your data is retained as long as your account is active. Two self-serve controls live
          in Settings:
        </p>
        <ul style={list}>
          <Bullet>
            <strong style={{ color: 'var(--text)' }}>Reset my data</strong> wipes your resumes,
            jobs, documents, applications, and history so you can start fresh, while keeping your
            account and subscription.
          </Bullet>
          <Bullet>
            <strong style={{ color: 'var(--text)' }}>Delete account</strong> permanently removes
            your account and all associated data, including uploaded files. Deleted data is
            removed from our systems within 30 days.
          </Bullet>
        </ul>
      </section>

      <section style={{ marginBottom: '48px' }}>
        <h2 style={h2}>Your rights</h2>
        <p style={p}>
          Vantage is built for Canadian users, and we comply with Canada&rsquo;s PIPEDA (Personal
          Information Protection and Electronic Documents Act). You have the right to:
        </p>
        <ul style={list}>
          <Bullet>Access the data we hold about you (email us for a copy).</Bullet>
          <Bullet>Correct inaccurate data (most of it is editable on your Profile).</Bullet>
          <Bullet>Withdraw consent, reset your data, or delete your account.</Bullet>
        </ul>
        <p style={{ ...p, marginTop: '20px', marginBottom: 0 }}>
          To exercise these rights or ask anything about your data, contact
          ishvir.chopra@gmail.com. See also the{' '}
          <Link href="/data-compliance" style={linkStyle}>Data Compliance</Link> page for how we
          meet these obligations.
        </p>
      </section>

      <section>
        <p style={{ color: 'var(--muted)', lineHeight: 1.7, fontSize: '0.88rem', fontStyle: 'italic' }}>
          This privacy policy is in plain English because we believe you should understand how we
          use your data. If you have questions or concerns, please reach out.
        </p>
      </section>
    </div>
  );
}
