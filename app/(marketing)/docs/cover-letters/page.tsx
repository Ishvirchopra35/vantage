import DocsLayout from '@/components/marketing/DocsLayout';
import Link from 'next/link';
import ArrowIcon from '@/components/ui/ArrowIcon';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Cover Letters · Docs',
  description: 'Generate keyword-driven cover letters that sound like you, not a template.',
  alternates: { canonical: '/docs/cover-letters' },
};

export default function CoverLettersPage() {
  return (
    <DocsLayout>
      <div>
        <h1 style={heading}>Cover letters</h1>
        <p style={summary}>Generate keyword-driven cover letters that sound like you, not a template.</p>

        <section style={section}>
          <h2 style={h2}>How it works</h2>
          <p style={p}>Cover letter generation uses the same keyword extraction as resume tailoring. The AI builds a three-paragraph letter that incorporates the job&apos;s target keywords while drawing from your actual experience, profile data, and application history.</p>
          <p style={p}>The system prompt enforces strict rules: no cliches (&quot;I am excited to apply&quot;, &quot;I am a team player&quot;), exactly three paragraphs, and a tone that sounds like the candidate -not a generic template. The AI references specific projects, roles, or skills from your resume rather than making vague claims.</p>
        </section>

        <section style={section}>
          <h2 style={h2}>How to use it</h2>
          <ol style={ol}>
            <li style={li}>On the <strong style={strong}>Tailor</strong> page, analyze a job (paste it, then <strong style={strong}>Analyze job</strong>).</li>
            <li style={li}>Open the <strong style={strong}>Cover Letter</strong> tab and click <strong style={strong}>Generate Cover Letter</strong>.</li>
            <li style={li}>Review the output. Edit anything that does not sound right.</li>
            <li style={li}>Copy and use it in your application. It is also saved to your <strong style={strong}>Documents</strong>.</li>
          </ol>
        </section>

        <section style={section}>
          <h2 style={h2}>What to expect</h2>
          <p style={p}>A three-paragraph cover letter that references specific details from the job listing and your resume. The first paragraph establishes relevance, the second highlights your most applicable experience, and the third connects your goals to the company. Keyword coverage is woven in naturally throughout.</p>
          <p style={p}>The AI does not write fiction. It can only reference experience that exists in your profile and resume. If the cover letter sounds generic or off, it usually means your profile is incomplete -the AI had insufficient context to personalize effectively.</p>
        </section>

        <section style={section}>
          <h2 style={h2}>Tips for best results</h2>
          <ul style={ul}>
            <li style={li}>Complete your profile thoroughly. The cover letter quality is directly proportional to how much the AI knows about you.</li>
            <li style={li}>Upload a comprehensive base resume. The AI pulls specific examples from your work history.</li>
            <li style={li}>Always edit the output. A generated cover letter is a strong first draft, not a finished product.</li>
          </ul>
        </section>

        <section style={section}>
          <h2 style={h2}>Common issues</h2>
          <div style={faq}>
            <p style={faqQ}>The cover letter sounds too generic.</p>
            <p style={p}>Check your profile page - is it fully filled out? Missing skills, target roles, or a sparse resume give the AI too little to work with.</p>
          </div>
          <div style={faq}>
            <p style={faqQ}>The letter mentions experience I do not have.</p>
            <p style={p}>This is rare but can happen if your resume text is ambiguous. Review your uploaded resume for clarity and re-generate.</p>
          </div>
        </section>

        <p style={updated}>Last updated: July 8, 2026</p>
        <div style={nav}>
          <Link href="/docs/ats-scoring" style={navLink}><ArrowIcon direction="left" /> ATS scoring</Link>
          <Link href="/docs/application-tracking" style={navLink}>Application tracking <ArrowIcon /></Link>
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
