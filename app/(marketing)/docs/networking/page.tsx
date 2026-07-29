import DocsLayout from '@/components/marketing/DocsLayout';
import Link from 'next/link';
import ArrowIcon from '@/components/ui/ArrowIcon';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Networking Assistant · Docs',
  description: 'Find contacts at target companies and generate personalized outreach messages.',
  alternates: { canonical: '/docs/networking' },
};

export default function NetworkingPage() {
  return (
    <DocsLayout>
      <div>
        <h1 style={heading}><span className="lph-metal">Networking assistant</span></h1>
        <p style={summary}>Find contacts at target companies and generate personalized outreach messages for connection requests, cold emails, and follow-ups.</p>

        <section style={section}>
          <h2 style={h2}>How it works</h2>
          <p style={p}>The networking assistant has two parts: contact sourcing and message generation.</p>
          <p style={p}><strong style={strong}>Contact sourcing</strong> searches public LinkedIn profiles for recruiters, hiring managers, and talent acquisition people at your target company. This is a best-effort search - it surfaces likely contacts but cannot guarantee finding a specific individual, and it is capped at a set number of searches per day.</p>
          <p style={p}><strong style={strong}>Message generation</strong> creates personalized outreach messages based on the contact&apos;s role, company, and your profile. Messages reference your actual experience and the specific company rather than using generic templates.</p>
        </section>

        <section style={section}>
          <h2 style={h2}>How to use it</h2>
          <ol style={ol}>
            <li style={li}>Navigate to the <strong style={strong}>Networking</strong> page in your dashboard.</li>
            <li style={li}>Enter a target company name and optionally a specific role or department.</li>
            <li style={li}>Review the suggested contacts.</li>
            <li style={li}>Select a contact and choose the message type:
              <ul style={{ ...ul, marginTop: '8px' }}>
                <li style={li}><strong style={strong}>Connection request</strong> - 280 character limit (LinkedIn limit)</li>
                <li style={li}><strong style={strong}>Cold email</strong> - Full-length professional email</li>
                <li style={li}><strong style={strong}>Follow-up</strong> - A shorter follow-up after initial outreach</li>
              </ul>
            </li>
            <li style={li}>Review and edit the generated message, then copy it.</li>
            <li style={li}>Toggle the &quot;Sent&quot; switch after sending to track your outreach.</li>
          </ol>
        </section>

        <section style={section}>
          <h2 style={h2}>What to expect</h2>
          <p style={p}>Messages are personalized to the specific contact and company. Connection requests stay within the 280-character LinkedIn limit. Cold emails follow a professional structure. Follow-ups reference the original outreach.</p>
          <p style={p}>The sent toggle lets you track which messages you have actually sent, giving you a record of your networking activity alongside your application tracker.</p>
        </section>

        <section style={section}>
          <h2 style={h2}>Tips for best results</h2>
          <ul style={ul}>
            <li style={li}>Always personalize the generated message further. A good AI draft plus a personal touch outperforms either alone.</li>
            <li style={li}>Reach out to more than one contact at a company. A recruiter and a hiring manager often respond very differently.</li>
            <li style={li}>Send connection requests and follow up with a cold email if no response after a week.</li>
          </ul>
        </section>

        <section style={section}>
          <h2 style={h2}>Common issues</h2>
          <div style={faq}>
            <p style={faqQ}>No contacts found for my target company.</p>
            <p style={p}>The contact sourcing relies on publicly available LinkedIn data. Smaller companies or companies with strict privacy settings may not surface contacts. Try broadening the department or role filter.</p>
          </div>
          <div style={faq}>
            <p style={faqQ}>The generated message sounds too generic.</p>
            <p style={p}>Complete your profile - especially target roles and skills. The AI uses your profile data to personalize messages. A sparse profile produces generic output.</p>
          </div>
        </section>

        <p style={updated}>Last updated: July 8, 2026</p>
        <div style={nav}>
          <Link href="/docs/strategy-feedback" style={navLink}><ArrowIcon direction="left" /> Strategy feedback</Link>
          <Link href="/docs/interview-prep" style={navLink}>Interview prep <ArrowIcon /></Link>
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
