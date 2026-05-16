import DocsLayout from '@/components/marketing/DocsLayout';
import Link from 'next/link';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Auto-fill - Vantage Docs',
  description: 'Fill out job application forms using the browser extension, console snippet, or answers panel.',
};

export default function AutoFillPage() {
  return (
    <DocsLayout>
      <div>
        <h1 style={heading}>Auto-fill</h1>
        <p style={summary}>Fill out job application forms in seconds using the browser extension, console snippet, or copy-paste answers panel.</p>

        {/* Section 1: Extension */}
        <section style={section}>
          <h2 style={h2}>Option 1: Using the Chrome extension (recommended)</h2>
          <p style={p}>The browser extension is the fastest and most reliable way to fill application forms. It works directly in your browser without requiring any technical knowledge.</p>
          <ol style={ol}>
            <li style={li}>Go to <strong style={strong}>Profile → Browser Extension → Generate token</strong> in your Vantage dashboard.</li>
            <li style={li}>Install the Vantage extension from the Chrome Web Store.</li>
            <li style={li}>Open the extension popup and paste your token to connect your account.</li>
            <li style={li}>Navigate to any job application form in Chrome.</li>
            <li style={li}>Click the Vantage extension icon and select <strong style={strong}>&quot;Fill this form.&quot;</strong></li>
            <li style={li}><strong style={strong}>Review all filled fields.</strong> The extension never submits the form for you - you always review and submit manually.</li>
          </ol>
          <p style={p}><strong style={strong}>Limitations:</strong> File upload fields (resume PDF) must be uploaded manually. CAPTCHAs must be solved manually. The extension works on Greenhouse, Lever, Workday, and most other ATS platforms.</p>
        </section>

        {/* Section 2: Console snippet */}
        <section style={section}>
          <h2 style={h2}>Option 2: Using the console snippet</h2>
          <p style={p}>For users who prefer not to install the extension. This method pastes a generated JavaScript snippet into the browser console.</p>
          <ol style={ol}>
            <li style={li}>Open the job application form in your browser.</li>
            <li style={li}>In Vantage, go to <strong style={strong}>Apply Prep → Auto-fill → Console tab</strong>.</li>
            <li style={li}>Click <strong style={strong}>&quot;Generate snippet.&quot;</strong></li>
            <li style={li}>Copy the generated snippet.</li>
            <li style={li}>On the application form page, press <strong style={strong}>F12</strong> to open Developer Tools, go to the <strong style={strong}>Console</strong> tab, paste the snippet, and press <strong style={strong}>Enter</strong>.</li>
            <li style={li}>Review all filled fields and submit manually.</li>
          </ol>
          <p style={p}>The console snippet uses the same fill logic as the extension - including the nativeSetter pattern that works with React-based ATS platforms.</p>
        </section>

        {/* Section 3: Answers panel */}
        <section style={section}>
          <h2 style={h2}>Option 3: Using the answers panel</h2>
          <p style={p}>For users who want to copy-paste answers manually without any automated filling.</p>
          <ol style={ol}>
            <li style={li}>Go to <strong style={strong}>Apply Prep → Auto-fill → Copy-paste tab</strong>.</li>
            <li style={li}>Paste the application form URL.</li>
            <li style={li}>Vantage analyzes the form and generates answers for every detected field.</li>
            <li style={li}>Copy each answer and paste it into the corresponding form field manually.</li>
          </ol>
        </section>

        <section style={section}>
          <h2 style={h2}>What to expect</h2>
          <p style={p}>All three methods generate answers from your Vantage profile, resume, and the specific job listing. The extension and console snippet fill fields automatically using the nativeSetter pattern, which correctly sets values in React, Vue, and Angular controlled inputs that would silently ignore a standard value assignment.</p>
          <p style={p}>The auto-fill system never clicks submit buttons or submits forms automatically. You always have the opportunity to review every field before submitting.</p>
        </section>

        <section style={section}>
          <h2 style={h2}>Tips for best results</h2>
          <ul style={ul}>
            <li style={li}>Complete your profile and upload your resume before using auto-fill. The quality of generated answers depends on available context.</li>
            <li style={li}>Always review filled fields - AI-generated answers may need minor adjustments for accuracy.</li>
            <li style={li}>If a field is not filled correctly, you can manually type the correct answer. The auto-fill is a starting point, not a final submission.</li>
          </ul>
        </section>

        <section style={section}>
          <h2 style={h2}>Common issues</h2>
          <div style={faq}>
            <p style={faqQ}>Some fields are not being filled.</p>
            <p style={p}>Some ATS platforms use non-standard form elements. Try the console snippet if the extension misses fields, or use the answers panel as a fallback.</p>
          </div>
          <div style={faq}>
            <p style={faqQ}>The extension is not detecting the form.</p>
            <p style={p}>Make sure you are on the actual application form page, not the job listing. Some platforms require you to click &quot;Apply&quot; before the form loads.</p>
          </div>
          <div style={faq}>
            <p style={faqQ}>CAPTCHA is blocking the fill.</p>
            <p style={p}>Solve the CAPTCHA manually first, then run the auto-fill. CAPTCHAs cannot be bypassed automatically.</p>
          </div>
        </section>

        <p style={updated}>Last updated: May 15, 2026</p>
        <div style={nav}>
          <Link href="/docs/application-tracking" style={navLink}>← Application tracking</Link>
          <Link href="/docs/strategy-feedback" style={navLink}>Strategy feedback →</Link>
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
