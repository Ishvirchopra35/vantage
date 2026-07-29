import DocsLayout from '@/components/marketing/DocsLayout';
import Link from 'next/link';
import ArrowIcon from '@/components/ui/ArrowIcon';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Interview Prep · Docs',
  description: 'Practice behavioral, technical, and company-specific interview questions with voice or text mode.',
  alternates: { canonical: '/docs/interview-prep' },
};

export default function InterviewPrepPage() {
  return (
    <DocsLayout>
      <div>
        <h1 style={heading}><span className="lph-metal">Interview prep</span></h1>
        <p style={summary}>Practice behavioral, technical, and company-specific interview questions with AI-powered feedback in voice or text mode.</p>

        <section style={section}>
          <h2 style={h2}>How to use it</h2>
          <ol style={ol}>
            <li style={li}>Go to the <strong style={strong}>Interview Prep</strong> page in your dashboard.</li>
            <li style={li}>Select a job from your tracker or enter a role and company manually.</li>
            <li style={li}>Generate the questions, then switch between the three tabs:
              <ul style={{ ...ul, marginTop: '8px' }}>
                <li style={li}><strong style={strong}>Behavioral</strong> - Situation-based questions best answered in STAR format (Situation, Task, Action, Result).</li>
                <li style={li}><strong style={strong}>Technical</strong> - Technical questions drawn from the job&apos;s requirements and your skills.</li>
                <li style={li}><strong style={strong}>Role-specific</strong> - Questions targeted at the specific role and its day-to-day responsibilities.</li>
              </ul>
            </li>
            <li style={li}>Set how you want to answer with the <strong style={strong}>Answer with</strong> control at the top of the session - <strong style={strong}>Voice</strong> or <strong style={strong}>Type</strong>. It applies to every question in the session.</li>
            <li style={li}>Answer a question, then review the AI assessment.</li>
          </ol>
        </section>

        <section style={section}>
          <h2 style={h2}>What to expect</h2>
          <p style={p}>In voice mode, you speak your answer and the browser transcribes it using the Web Speech API. In type mode, you type it. Either way, the AI returns a structured assessment:</p>
          <ul style={ul}>
            <li style={li}><strong style={strong}>Content score</strong> - How well the substance of your answer addresses what the interviewer is looking for.</li>
            <li style={li}><strong style={strong}>Delivery score</strong> - How clearly and concisely the answer is delivered, including any filler words detected (&quot;um,&quot; &quot;uh,&quot; &quot;like&quot;).</li>
            <li style={li}><strong style={strong}>Strengths and improvements</strong> - What worked, what to fix, and a hint at a stronger answer.</li>
          </ul>
          <p style={p}>An overall score out of 10 sits on top of the two sub-scores. Practice sessions are saved automatically, so you can come back to a session or review past ones to track improvement.</p>
        </section>

        <section style={section}>
          <h2 style={h2}>Tips for best results</h2>
          <ul style={ul}>
            <li style={li}>Use voice mode whenever possible - it simulates the real interview experience more closely than typing.</li>
            <li style={li}>For behavioral questions, structure your answers using STAR format: Situation, Task, Action, Result.</li>
            <li style={li}>Practice the same question multiple times. The AI assessment highlights different aspects each time, helping you refine your answer.</li>
          </ul>
        </section>

        <section style={section}>
          <h2 style={h2}>Common issues</h2>
          <div style={faq}>
            <p style={faqQ}>Voice mode is not available in my browser.</p>
            <p style={p}>Voice mode requires the Web Speech API, which is supported in Chrome and Edge. Firefox and Safari users will see a text fallback. For the best experience, use Chrome.</p>
          </div>
          <div style={faq}>
            <p style={faqQ}>The transcription is inaccurate.</p>
            <p style={p}>Web Speech API transcription quality depends on your microphone and ambient noise. Use a quiet environment and speak clearly. Technical jargon may be transcribed incorrectly - the AI assessment accounts for this.</p>
          </div>
          <div style={faq}>
            <p style={faqQ}>Can I delete a practice session?</p>
            <p style={p}>Yes. You can delete any saved session from the Interview Prep page. This does not affect your other data.</p>
          </div>
        </section>

        <p style={updated}>Last updated: July 8, 2026</p>
        <div style={nav}>
          <Link href="/docs/networking" style={navLink}><ArrowIcon direction="left" /> Networking assistant</Link>
          <Link href="/docs/billing" style={navLink}>Billing <ArrowIcon /></Link>
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
