import DocsLayout from '@/components/marketing/DocsLayout';
import Link from 'next/link';
import ArrowIcon from '@/components/ui/ArrowIcon';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Resume Tailoring · Docs',
  description: 'Learn how Vantage rewrites your resume to match ATS keywords without fabricating experience.',
  alternates: { canonical: '/docs/resume-tailoring' },
};

export default function ResumeTailoringPage() {
  return (
    <DocsLayout>
      <div>
        <h1 style={heading}><span className="lph-metal">Resume tailoring</span></h1>
        <p style={summary}>
          Reword and reposition your existing experience to match the ATS keywords extracted from each job listing.
        </p>

        <section style={section}>
          <h2 style={h2}>How it works</h2>
          <p style={p}>
            When you paste a job URL or description into the Tailor page, Vantage reads the listing and pulls out a comprehensive keyword list. This is not just the skills section - it includes all significant terminology the ATS would scan for, including industry jargon, tools, methodologies, certifications, and soft skills mentioned throughout the posting.
          </p>
          <p style={p}>
            The tailoring engine then rewords your bullet points against that keyword list, incorporating the job&apos;s own terminology wherever your existing work genuinely touches it. It follows a strict rule: <strong style={strong}>tailoring never fabricates experience</strong>. If you do not have experience with something the job requires, it is listed as a skill gap - not invented.
          </p>
          <p style={p}>
            Only your bullet points and summary are ever rewritten. Your section headings, job titles, company names, dates and education come back exactly as they went in, and so does the number of bullets under each role - this is checked mechanically before a tailored resume is accepted, not left to the AI to respect. Rewritten bullets are also held to roughly the original&apos;s length, so a one-page resume stays one page.
          </p>
        </section>

        <section style={section}>
          <h2 style={h2}>How to use it</h2>
          <ol style={ol}>
            <li style={li}>Go to the <strong style={strong}>Tailor</strong> page from your dashboard.</li>
            <li style={li}>Paste the job posting URL, or switch to pasting the job description text directly.</li>
            <li style={li}>Click <strong style={strong}>Analyze job</strong>. Vantage reads the listing and pulls out the keywords (usually 5 to 10 seconds).</li>
            <li style={li}>Review the parsed job, then click <strong style={strong}>Tailor My Resume</strong> to generate the optimized version.</li>
            <li style={li}>Read the result in the <strong style={strong}>Tailored Resume</strong> tab. <strong style={strong}>Bullet changes</strong> shows exactly which bullets moved and why; skill gaps are listed alongside, and the <strong style={strong}>ATS Score</strong> tab shows the before/after.</li>
            <li style={li}>Switch to <strong style={strong}>Full resume</strong> to see the whole thing. Click any line to edit it - your changes are kept for the download.</li>
            <li style={li}>Download it as <strong style={strong}>Word</strong> or <strong style={strong}>PDF</strong>. The Word file keeps your design - it is built by putting your text into your own resume file. The PDF is a clean standard layout with the same content and working links.</li>
          </ol>
        </section>

        <section style={section}>
          <h2 style={h2}>What to expect</h2>
          <p style={p}>
            The output is your resume with its bullet points reworded for the specific role, downloadable as Word or PDF. You will see a before/after ATS score comparison when both scores are available, showing exactly how much the tailoring improved your match. Skill gaps - keywords the job requires that are not reflected anywhere in your experience - are listed separately so you know where the mismatches are.
          </p>
          <p style={p}>
            It is normal for only a handful of bullets to change. A bullet that already reads well for the job is left alone rather than edited for the sake of it.
          </p>
          <p style={p}>
            The AI does not add skills you do not have, exaggerate your experience level, or change the factual content of your work history. It only changes how your existing experience is described. Hyperlinks in your original resume - LinkedIn, GitHub, portfolio, email - stay clickable in either download.
          </p>
        </section>

        <section style={section}>
          <h2 style={h2}>Tips for best results</h2>
          <ul style={ul}>
            <li style={li}>
              Upload a comprehensive base resume with all your experience, not a trimmed version. The more raw material the AI has, the better it can match keywords.
            </li>
            <li style={li}>
              Complete your profile - especially target roles and skills. The AI uses your profile data as additional context.
            </li>
            <li style={li}>
              After reviewing the tailored resume, manually add any skill gaps that you can honestly claim partial experience with. The AI is conservative and may miss transferable skills.
            </li>
          </ul>
        </section>

        <section style={section}>
          <h2 style={h2}>Common issues</h2>
          <div style={faq}>
            <p style={faqQ}>The tailored resume does not look much different from my original.</p>
            <p style={p}>
              This means your resume was already a strong keyword match for the role. Check the ATS score - if it is above 75 before tailoring, there is limited room for improvement.
            </p>
          </div>
          <div style={faq}>
            <p style={faqQ}>The output has too many skill gaps.</p>
            <p style={p}>
              A large skill gap list usually means the job requires experience you genuinely do not have. This is useful information -it tells you whether this role is realistic to pursue or if you should focus on closer matches.
            </p>
          </div>
          <div style={faq}>
            <p style={faqQ}>My downloaded resume does not look like my own resume.</p>
            <p style={p}>
              The Word download is built from the file you uploaded, so it can only keep your
              design if you uploaded a Word file. If your base resume is a PDF, upload a .docx
              version on the Profile page - either as your resume or as a template - and
              downloads will match it. The PDF download always uses a standard layout; for a PDF
              in your own design, download the Word file and save it as a PDF from Word.
            </p>
          </div>
          <div style={faq}>
            <p style={faqQ}>Can I tailor the same resume for multiple jobs?</p>
            <p style={p}>
              Yes. Each tailoring generates a new version specific to that job. Your base resume is never modified.
            </p>
          </div>
        </section>

        <p style={updated}>Last updated: July 8, 2026</p>

        <div style={nav}>
          <Link href="/docs/getting-started" style={navLink}><ArrowIcon direction="left" /> Getting started</Link>
          <Link href="/docs/ats-scoring" style={navLink}>ATS scoring <ArrowIcon /></Link>
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
const faq: React.CSSProperties = { marginBottom: '24px' };
const faqQ: React.CSSProperties = { fontWeight: 600, color: 'var(--text)', fontSize: '0.95rem', marginBottom: '6px' };
const updated: React.CSSProperties = { fontSize: '0.82rem', color: 'var(--muted)', marginTop: '64px', marginBottom: '24px' };
const nav: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '24px', borderTop: '1px solid var(--border)' };
const navLink: React.CSSProperties = { color: 'var(--accent)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 };
