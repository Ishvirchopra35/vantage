import DocsLayout from '@/components/marketing/DocsLayout';
import Link from 'next/link';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Getting Started -Vantage Docs',
  description: 'Set up your Vantage account, upload your resume, and submit your first tailored application.',
};

export default function GettingStartedPage() {
  return (
    <DocsLayout>
      <div>
        <h1 style={heading}>Getting started</h1>
        <p style={summary}>
          Set up your Vantage account and submit your first tailored application in under five minutes.
        </p>

        <section style={section}>
          <h2 style={h2}>How to use it</h2>
          <ol style={ol}>
            <li style={li}>
              <strong style={strong}>Create your account</strong> - Go to{' '}
              <Link href="/signup" style={link}>/signup</Link> and sign up with your email. No credit card required.
            </li>
            <li style={li}>
              <strong style={strong}>Upload your resume</strong> - Navigate to your Profile page and upload your resume as a PDF (max 5 MB). Vantage extracts the text automatically so it can be used for tailoring and scoring.
            </li>
            <li style={li}>
              <strong style={strong}>Complete your profile</strong> - Fill in your target roles, skills, university, and graduation year. This information is injected into every AI prompt, which significantly improves the quality and relevance of generated output.
            </li>
            <li style={li}>
              <strong style={strong}>Paste your first job URL</strong> - Go to the Tailor page and paste a job posting URL. Vantage fetches the listing, extracts the ATS keywords, and generates a tailored resume.
            </li>
            <li style={li}>
              <strong style={strong}>Review your ATS score and tailored resume</strong> - Compare your original score against the tailored version. Look at the keyword matches and any skill gaps listed at the bottom.
            </li>
            <li style={li}>
              <strong style={strong}>Log the application in your tracker</strong> - After you apply, add the job to your application tracker so you can monitor your status and response rate over time.
            </li>
          </ol>
        </section>

        <section style={section}>
          <h2 style={h2}>What to expect</h2>
          <p style={p}>
            After completing these steps, you will have a tailored resume optimized for the specific job you applied to, an ATS compatibility score showing how well your resume matches the listing, and a logged application entry in your tracker. As you add more applications, Vantage builds a picture of your job search and uses that context to improve every future AI output.
          </p>
        </section>

        <section style={section}>
          <h2 style={h2}>Tips for best results</h2>
          <ul style={ul}>
            <li style={li}>
              Fill in every profile field. The more context Vantage has about you, the better the AI output. Target roles and skills are especially important.
            </li>
            <li style={li}>
              Upload a comprehensive base resume rather than a trimmed one-page version. Vantage works best when it has more experience to draw from.
            </li>
            <li style={li}>
              Use the actual job posting URL rather than pasting the description manually. URL-based parsing captures more structured data from the listing.
            </li>
          </ul>
        </section>

        <section style={section}>
          <h2 style={h2}>Common issues</h2>
          <div style={faq}>
            <p style={faqQ}>My resume upload failed.</p>
            <p style={p}>
              Make sure the file is a PDF and under 5 MB. Scanned image PDFs without selectable text may not extract properly - use a PDF with real text content.
            </p>
          </div>
          <div style={faq}>
            <p style={faqQ}>The job URL did not parse correctly.</p>
            <p style={p}>
              Some job boards use heavy JavaScript rendering that prevents content extraction. If the URL fails, paste the job description text directly into the text input on the Tailor page.
            </p>
          </div>
          <div style={faq}>
            <p style={faqQ}>My tailored resume does not look very different from my original.</p>
            <p style={p}>
              This usually means your original resume was already a strong match for the role. Check the ATS score - if it is already above 75, there is less room for improvement. If your profile is incomplete, complete it to give the AI more context.
            </p>
          </div>
        </section>

        <p style={updated}>Last updated: May 15, 2026</p>

        <div style={nav}>
          <span />
          <Link href="/docs/resume-tailoring" style={navLink}>Resume tailoring →</Link>
        </div>
      </div>
    </DocsLayout>
  );
}

const heading: React.CSSProperties = { fontSize: '2rem', fontWeight: 700, color: 'var(--text)', marginBottom: '8px', lineHeight: 1.2 };
const summary: React.CSSProperties = { fontSize: '1.05rem', color: 'var(--muted)', marginBottom: '48px', lineHeight: 1.6 };
const section: React.CSSProperties = { marginBottom: '48px' };
const h2: React.CSSProperties = { fontSize: '1.2rem', fontWeight: 600, color: 'var(--text)', marginBottom: '16px', lineHeight: 1.3 };
const p: React.CSSProperties = { color: 'var(--text)', lineHeight: 1.7, marginBottom: '16px', fontSize: '0.95rem', opacity: 0.85 };
const ol: React.CSSProperties = { paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' };
const ul: React.CSSProperties = { listStyle: 'disc', paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' };
const li: React.CSSProperties = { color: 'var(--text)', lineHeight: 1.7, fontSize: '0.95rem', opacity: 0.85 };
const strong: React.CSSProperties = { fontWeight: 600, color: 'var(--text)' };
const link: React.CSSProperties = { color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: '3px' };
const faq: React.CSSProperties = { marginBottom: '24px' };
const faqQ: React.CSSProperties = { fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem', marginBottom: '6px' };
const updated: React.CSSProperties = { fontSize: '0.82rem', color: 'var(--muted)', marginTop: '64px', marginBottom: '24px' };
const nav: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '24px', borderTop: '1px solid var(--border)' };
const navLink: React.CSSProperties = { color: 'var(--accent)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 };
