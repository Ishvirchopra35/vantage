import DocsLayout from '@/components/marketing/DocsLayout';
import Link from 'next/link';
import ArrowIcon from '@/components/ui/ArrowIcon';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Billing Â· Docs',
  description: 'Free vs Pro plan comparison, how to upgrade, cancel, and manage your Vantage subscription.',
  alternates: { canonical: '/docs/billing' },
};

export default function BillingPage() {
  return (
    <DocsLayout>
      <div>
        <h1 style={heading}><span className="lph-metal">Billing</span></h1>
        <p style={summary}>Free vs Pro plan comparison, how to upgrade, and how to manage your subscription.</p>

        <section style={section}>
          <h2 style={h2}>Plan comparison</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Feature</th>
                  <th style={th}>Free ($0/mo)</th>
                  <th style={th}>Pro ($8/mo CAD)</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style={td}>Resume tailorings</td><td style={td}>10/month</td><td style={td}>Unlimited</td></tr>
                <tr><td style={td}>Cover letters</td><td style={td}>10/month</td><td style={td}>Unlimited</td></tr>
                <tr><td style={td}>Auto-apply credits</td><td style={td}>20/month</td><td style={td}>Unlimited</td></tr>
                <tr><td style={td}>Application tracking</td><td style={td}>150 total</td><td style={td}>Unlimited</td></tr>
                <tr><td style={td}>Strategy feedback</td><td style={td}>2/month</td><td style={td}>Unlimited</td></tr>
                <tr><td style={td}>Networking drafts</td><td style={td}>15/month</td><td style={td}>Unlimited</td></tr>
                <tr><td style={td}>Interview prep sessions</td><td style={td}>5/month</td><td style={td}>Unlimited</td></tr>
                <tr><td style={td}>Support</td><td style={td}>Email</td><td style={td}>Priority</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section style={section}>
          <h2 style={h2}>How to upgrade</h2>
          <ol style={ol}>
            <li style={li}>Go to your dashboard and click <strong style={strong}>&quot;Upgrade to Pro&quot;</strong> in the sidebar, or navigate directly to <Link href="/billing" style={link}>/billing</Link>.</li>
            <li style={li}>You will be redirected to Stripe&apos;s checkout page.</li>
            <li style={li}>Complete payment. Your plan upgrades immediately.</li>
          </ol>
        </section>

        <section style={section}>
          <h2 style={h2}>How to cancel</h2>
          <ol style={ol}>
            <li style={li}>Go to <Link href="/billing" style={link}>/billing</Link>.</li>
            <li style={li}>Click <strong style={strong}>&quot;Manage subscription.&quot;</strong></li>
            <li style={li}>You will be redirected to the Stripe customer portal where you can cancel.</li>
            <li style={li}>Your Pro access continues until the end of the current billing period.</li>
          </ol>
        </section>

        <section style={section}>
          <h2 style={h2}>What to expect</h2>
          <p style={p}>All billing is handled through Stripe. Vantage never sees or stores your credit card information. Your Stripe customer ID and subscription status are the only billing-related data stored in our system.</p>
          <p style={p}><strong style={strong}>Refund policy:</strong> No refunds are issued for partial months. If you cancel mid-cycle, you retain Pro access until the end of the current billing period.</p>
        </section>

        <section style={section}>
          <h2 style={h2}>Early access note</h2>
          <p style={p}>During the early access period, free tier limits may not be enforced. This is intentional - we want early users to explore every feature without restrictions. When limits are activated, you will be notified in advance.</p>
        </section>

        <section style={section}>
          <h2 style={h2}>Common issues</h2>
          <div style={faq}>
            <p style={faqQ}>I upgraded but my limits have not changed.</p>
            <p style={p}>Try logging out and back in. If the issue persists, the Stripe webhook may not have processed yet - wait a few minutes and refresh.</p>
          </div>
          <div style={faq}>
            <p style={faqQ}>I was charged but cannot access Pro features.</p>
            <p style={p}>Contact us at ishvir.chopra@gmail.com with your account email and we will resolve it immediately.</p>
          </div>
        </section>

        <p style={updated}>Last updated: May 15, 2026</p>
        <div style={nav}>
          <Link href="/docs/interview-prep" style={navLink}><ArrowIcon direction="left" /> Interview prep</Link>
          <Link href="/docs/extension" style={navLink}>Browser extension <ArrowIcon /></Link>
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
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' };
const th: React.CSSProperties = { textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontWeight: 600, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em' };
const td: React.CSSProperties = { padding: '10px 14px', borderBottom: '1px solid var(--border)', color: 'var(--text)', opacity: 0.85 };
