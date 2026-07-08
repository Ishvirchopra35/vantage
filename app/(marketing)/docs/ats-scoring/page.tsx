import DocsLayout from '@/components/marketing/DocsLayout';
import Link from 'next/link';
import ArrowIcon from '@/components/ui/ArrowIcon';

export const dynamic = 'force-static';

export const metadata = {
  title: 'ATS Scoring · Docs',
  description: 'Understand how ATS systems evaluate resumes and how Vantage scores yours.',
  alternates: { canonical: '/docs/ats-scoring' },
};

export default function AtsScoringPage() {
  return (
    <DocsLayout>
      <div>
        <h1 style={heading}>ATS scoring</h1>
        <p style={summary}>Understand how automated screening systems evaluate your resume and how to improve your score.</p>

        <section style={section}>
          <h2 style={h2}>What ATS systems are and why they matter</h2>
          <p style={p}>An Applicant Tracking System (ATS) is software that companies use to manage job applications. Before a human ever reads your resume, the ATS scans it for keywords, formatting compatibility, and relevance to the job description. Resumes that do not pass the automated filter are often never seen by a recruiter.</p>
          <p style={p}>This is not a hypothetical problem. In Vantage user surveys, 75% of respondents reported a response rate below 5% - meaning fewer than 5 out of every 100 applications led to any response. Poor ATS compatibility is one of the primary causes.</p>
        </section>

        <section style={section}>
          <h2 style={h2}>How to use it</h2>
          <ol style={ol}>
            <li style={li}>Go to the <strong style={strong}>Tailor</strong> page and paste a job posting URL or description.</li>
            <li style={li}>Once Vantage reads the job, open the <strong style={strong}>ATS Score</strong> tab. It compares your resume against the extracted keywords and evaluates four sub-scores.</li>
            <li style={li}>Review your overall score, each sub-score, and the keywords you match versus the ones you are missing.</li>
            <li style={li}>Open the <strong style={strong}>ATS</strong> page from your dashboard any time to see your saved scores and how they trend over time.</li>
          </ol>
        </section>

        <section style={section}>
          <h2 style={h2}>What to expect</h2>
          <p style={p}>Vantage calculates four sub-scores that combine into an overall ATS compatibility score:</p>
          <ul style={ul}>
            <li style={li}><strong style={strong}>Keyword match</strong> - How many of the job&apos;s target keywords appear in your resume. This is typically the most impactful score.</li>
            <li style={li}><strong style={strong}>Format</strong> - Whether your resume structure is ATS-friendly. Simple, clean formatting scores highest.</li>
            <li style={li}><strong style={strong}>Experience</strong> - How well your experience level matches the job&apos;s requirements.</li>
            <li style={li}><strong style={strong}>Skills</strong> - Coverage of the specific technical and soft skills the listing emphasizes.</li>
          </ul>
        </section>

        <section style={section}>
          <h2 style={h2}>How to interpret your score</h2>
          <ul style={ul}>
            <li style={li}><strong style={strong}>0 - 49: Needs work.</strong> Significant gaps in keyword coverage or formatting. Tailoring will produce a large improvement.</li>
            <li style={li}><strong style={strong}>50 - 74: Competitive.</strong> Reasonable match with room for optimization.</li>
            <li style={li}><strong style={strong}>75+: Strong.</strong> Your resume is a strong ATS match. Focus on the application itself.</li>
          </ul>
        </section>

        <section style={section}>
          <h2 style={h2}>Tips for best results</h2>
          <ul style={ul}>
            <li style={li}>The most impactful improvement is almost always keyword coverage. Use the tailoring feature to incorporate missing keywords from your existing experience.</li>
            <li style={li}>Use a simple, single-column resume format. ATS systems struggle to read multi-column layouts, tables, and embedded images.</li>
            <li style={li}>Use standard section headings like &quot;Experience,&quot; &quot;Education,&quot; and &quot;Skills&quot; rather than creative alternatives.</li>
          </ul>
        </section>

        <section style={section}>
          <h2 style={h2}>Common issues</h2>
          <div style={faq}>
            <p style={faqQ}>My score seems too low even though I am qualified.</p>
            <p style={p}>ATS scoring is about keyword presence, not qualifications. You may be highly qualified but using different terminology. Tailoring rewrites your resume to use the listing&apos;s exact phrasing.</p>
          </div>
          <div style={faq}>
            <p style={faqQ}>My format score is low but my resume looks fine.</p>
            <p style={p}>How a resume looks and how well an ATS can read it are two different things. A beautifully designed resume with columns or icons may confuse an ATS. Use a simple, text-based layout.</p>
          </div>
        </section>

        <p style={updated}>Last updated: July 8, 2026</p>
        <div style={nav}>
          <Link href="/docs/resume-tailoring" style={navLink}><ArrowIcon direction="left" /> Resume tailoring</Link>
          <Link href="/docs/cover-letters" style={navLink}>Cover letters <ArrowIcon /></Link>
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
