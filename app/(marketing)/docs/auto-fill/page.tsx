import DocsLayout from '@/components/marketing/DocsLayout';
import Link from 'next/link';
import ArrowIcon from '@/components/ui/ArrowIcon';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Auto-fill · Docs',
  description: 'Fill job application forms with the Vantage Chrome extension, and generate answers to open-ended application questions.',
  alternates: { canonical: '/docs/auto-fill' },
};

export default function AutoFillPage() {
  return (
    <DocsLayout>
      <div>
        <h1 style={heading}><span className="lph-metal">Auto-fill</span></h1>
        <p style={summary}>Fill job application forms with the Vantage Chrome extension, and generate answers to the open-ended questions applications ask.</p>

        <section style={section}>
          <h2 style={h2}>Where auto-fill lives</h2>
          <p style={p}>Open <strong style={strong}>Auto-apply</strong> from the sidebar. The page walks you through setting up the Chrome extension once, then lists every application from your tracker. Pick one to open its apply workspace, where you will find your tailored resume and cover letter, an answer generator for application questions, and the extension fill.</p>
        </section>

        {/* Section 1: Set up the extension */}
        <section style={section}>
          <h2 style={h2}>Set up the extension first</h2>
          <p style={p}>Form filling runs through the Vantage Chrome extension, so set it up before your first application.</p>
          <ol style={ol}>
            <li style={li}>Install the Vantage extension from the <a href="https://chromewebstore.google.com/detail/vantage-auto-fill/mgapanbbaplohlojbmghoglmpfpogook" target="_blank" rel="noreferrer" style={link}>Chrome Web Store</a> (see the <Link href="/docs/extension" style={link}>browser extension</Link> guide for details).</li>
            <li style={li}>Go to <strong style={strong}>Profile <ArrowIcon /> Browser Extension <ArrowIcon /> Generate connection code</strong> in your Vantage dashboard.</li>
            <li style={li}>Open the extension popup and paste your connection code to link your account.</li>
          </ol>
        </section>

        {/* Section 2: Fill a form */}
        <section style={section}>
          <h2 style={h2}>Fill a form with the extension</h2>
          <ol style={ol}>
            <li style={li}>From <strong style={strong}>Auto-apply</strong>, pick a tracked application to open its apply workspace.</li>
            <li style={li}>Open the job&apos;s application form in Chrome.</li>
            <li style={li}>Click the <strong style={strong}>Vantage icon</strong> in your toolbar. The extension fills the fields it recognizes using your profile, resume, and the job listing.</li>
            <li style={li}><strong style={strong}>Review every field, then submit yourself.</strong> The extension never submits the form for you.</li>
          </ol>
          <p style={p}><strong style={strong}>Limitations:</strong> File upload fields (resume PDF) must be attached manually. CAPTCHAs must be solved manually. The extension uses the nativeSetter pattern, which correctly sets values in React, Vue, and Angular inputs that silently ignore a standard value assignment, so it works on Greenhouse, Lever, Workday, and most other ATS platforms (the software companies use to screen resumes).</p>
        </section>

        {/* Section 3: Application questions */}
        <section style={section}>
          <h2 style={h2}>Answer open-ended questions</h2>
          <p style={p}>Applications often include free-text prompts (&quot;Why do you want to work here?&quot;) that no form filler can answer well. The apply workspace has a question answerer for these.</p>
          <ol style={ol}>
            <li style={li}>In the application&apos;s apply workspace, find the <strong style={strong}>Application Questions</strong> section.</li>
            <li style={li}>Paste the question and click <strong style={strong}>Generate answer</strong>.</li>
            <li style={li}>Edit the draft, then click <strong style={strong}>Copy</strong> and paste it into the form.</li>
          </ol>
        </section>

        <section style={section}>
          <h2 style={h2}>What to expect</h2>
          <p style={p}>Both the extension fill and the question answerer draw on your Vantage profile, resume, and the specific job listing, so the more complete your profile, the better the output. Answers are a strong first draft - read and adjust them before you submit.</p>
          <p style={p}>The auto-fill system never clicks submit buttons or submits forms automatically. You always have the opportunity to review every field before submitting.</p>
        </section>

        <section style={section}>
          <h2 style={h2}>Tips for best results</h2>
          <ul style={ul}>
            <li style={li}>Complete your profile and upload your resume before using auto-fill. The quality of generated answers depends on available context.</li>
            <li style={li}>Always review filled fields - AI-generated answers may need minor adjustments for accuracy.</li>
            <li style={li}>If a field is not filled correctly, type the correct answer in yourself. The fill is a starting point, not a final submission.</li>
          </ul>
        </section>

        <section style={section}>
          <h2 style={h2}>Common issues</h2>
          <div style={faq}>
            <p style={faqQ}>Some fields are not being filled.</p>
            <p style={p}>Some ATS platforms use non-standard form elements the extension cannot detect. Fill those fields manually, and use the Application Questions answerer for any open-ended prompts.</p>
          </div>
          <div style={faq}>
            <p style={faqQ}>The extension is not detecting the form.</p>
            <p style={p}>Make sure you are on the actual application form page, not the job listing. Some platforms require you to click &quot;Apply&quot; before the form loads.</p>
          </div>
          <div style={faq}>
            <p style={faqQ}>CAPTCHA is blocking the fill.</p>
            <p style={p}>Solve the CAPTCHA manually first, then click the Vantage icon again. CAPTCHAs cannot be bypassed automatically.</p>
          </div>
        </section>

        <p style={updated}>Last updated: July 8, 2026</p>
        <div style={nav}>
          <Link href="/docs/application-tracking" style={navLink}><ArrowIcon direction="left" /> Application tracking</Link>
          <Link href="/docs/strategy-feedback" style={navLink}>Strategy feedback <ArrowIcon /></Link>
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
