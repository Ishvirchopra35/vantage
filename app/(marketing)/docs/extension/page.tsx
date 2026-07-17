import DocsLayout from '@/components/marketing/DocsLayout';
import Link from 'next/link';
import ArrowIcon from '@/components/ui/ArrowIcon';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Browser Extension Â· Docs',
  description: 'Install the Vantage Chrome extension, connect your account, and troubleshoot issues.',
  alternates: { canonical: '/docs/extension' },
};

export default function ExtensionPage() {
  return (
    <DocsLayout>
      <div>
        <h1 style={heading}><span className="lph-metal">Browser extension</span></h1>
        <p style={summary}>Install the Vantage Chrome extension to auto-fill job application forms directly in your browser.</p>

        <section style={section}>
          <h2 style={h2}>What the extension does</h2>
          <p style={p}>The Vantage Chrome extension reads job application forms in your browser and fills them with answers generated from your profile, resume, and the specific job listing. It uses the nativeSetter pattern to correctly set values in React-based ATS platforms (the software companies use to screen applications, such as Greenhouse, Lever, and Workday) that silently ignore standard JavaScript value assignments.</p>
          <p style={p}>The extension is how Vantage auto-fill works - there is no separate fill method to set up. The extension never submits forms automatically. It fills the fields and waits for you to review and submit manually.</p>
        </section>

        <section style={section}>
          <h2 style={h2}>Installing from the Chrome Web Store</h2>
          <ol style={ol}>
            <li style={li}>Open the <a href="https://chromewebstore.google.com/detail/vantage-auto-fill/mgapanbbaplohlojbmghoglmpfpogook" target="_blank" rel="noreferrer" style={link}>Vantage Auto-Fill listing</a> on the Chrome Web Store.</li>
            <li style={li}>Click <strong style={strong}>&quot;Add to Chrome.&quot;</strong></li>
            <li style={li}>Confirm the permissions prompt.</li>
            <li style={li}>The Vantage icon appears in your browser toolbar. Pin it for easy access.</li>
          </ol>
        </section>

        <section style={section}>
          <h2 style={h2}>Generating and using your connection code</h2>
          <ol style={ol}>
            <li style={li}>Go to <strong style={strong}>Profile <ArrowIcon /> Browser Extension</strong> in your Vantage dashboard.</li>
            <li style={li}>Click <strong style={strong}>&quot;Generate connection code.&quot;</strong></li>
            <li style={li}>Copy the code.</li>
            <li style={li}>Click the Vantage extension icon in your browser toolbar.</li>
            <li style={li}>Paste the code into the input field and click <strong style={strong}>&quot;Connect.&quot;</strong></li>
            <li style={li}>The extension is now linked to your account.</li>
          </ol>
          <p style={p}>Your connection code is stored securely in the extension. It does not expire automatically, but you can regenerate it from the Profile page at any time, which replaces the previous code.</p>
        </section>

        <section style={section}>
          <h2 style={h2}>Permissions and why they are needed</h2>
          <ul style={ul}>
            <li style={li}><strong style={strong}>activeTab</strong> - Allows the extension to read the current tab&apos;s page content when you click the Fill button. It cannot read other tabs or browse history.</li>
            <li style={li}><strong style={strong}>storage</strong> - Stores your connection code locally so you do not have to re-enter it every session.</li>
            <li style={li}><strong style={strong}>scripting</strong> - Injects the fill script into the application form page to set field values.</li>
          </ul>
          <p style={p}>The extension does not track your browsing, does not run in the background, and only activates when you explicitly click the Vantage icon and choose to fill a form. See the <Link href="/privacy" style={link}>Privacy Policy</Link> for full details on extension data handling.</p>
        </section>

        <section style={section}>
          <h2 style={h2}>Troubleshooting</h2>
          <div style={faq}>
            <p style={faqQ}>The extension is not filling fields.</p>
            <p style={p}>Some ATS platforms use non-standard form elements the extension cannot detect. Fill those fields in manually, and use the <strong style={strong}>Application Questions</strong> answerer on the apply workspace to draft answers for any open-ended prompts.</p>
          </div>
          <div style={faq}>
            <p style={faqQ}>My connection code is correct but the popup says it is invalid.</p>
            <p style={p}>This usually means the extension is on an older version. Go to <strong style={strong}>chrome://extensions</strong>, turn on <strong style={strong}>Developer mode</strong> (top right), and click <strong style={strong}>Update</strong> - Chrome also picks up new versions automatically within a few hours. Then try connecting again. If it still fails, generate a fresh code from your Profile page.</p>
          </div>
          <div style={faq}>
            <p style={faqQ}>Connection code expired or connection lost.</p>
            <p style={p}>Go to Profile <ArrowIcon /> Browser Extension in your dashboard and click &quot;Generate connection code&quot; to create a new one. Paste the new code into the extension popup. The old code stops working immediately.</p>
          </div>
          <div style={faq}>
            <p style={faqQ}>CAPTCHA is blocking the form fill.</p>
            <p style={p}>Solve the CAPTCHA manually first. Once the CAPTCHA is complete, click the Vantage fill button - it will fill the remaining fields. CAPTCHAs cannot be solved or bypassed automatically.</p>
          </div>
        </section>

        <p style={updated}>Last updated: July 17, 2026</p>
        <div style={nav}>
          <Link href="/docs/billing" style={navLink}><ArrowIcon direction="left" /> Billing</Link>
          <span />
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
