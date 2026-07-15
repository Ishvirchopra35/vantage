import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/requireAuth'
import { createClient } from '@/lib/supabase/server'
import { UpgradeButton, ManageButton, RefundButton } from '@/components/BillingActions'
import PageHeader from '@/components/ui/PageHeader'

interface Subscription {
  plan: string
  status: string
  current_period_end: string | null
  trial_end: string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function BillingPage() {
  if (process.env.ENABLE_FREEMIUM !== 'true') redirect('/dashboard')

  const auth = await requireAuth()
  if ('error' in auth) redirect('/login')
  const { user } = auth

  const supabase = await createClient()
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end, trial_end')
    .eq('user_id', user.id)
    .single()

  const s = sub as Subscription | null
  const plan = s?.plan ?? 'free'
  const isPro = plan === 'pro'
  const isTrialing = isPro && s?.status === 'trialing'

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Billing"
        subtitle="Manage your plan and usage."
      />

      {/* Current plan card */}
      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-md)', padding: '24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>
                {isPro ? 'Pro Plan' : 'Free Plan'}
              </span>
              <span style={{
                fontSize: '10px',
                padding: '2px 7px',
                background: 'var(--card-raised)',
                borderRadius: '20px',
                color: 'var(--muted)',
              }}>
                {isTrialing ? 'Free trial' : isPro ? 'Active' : 'Free tier'}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              {isTrialing
                ? `Trial ends ${formatDate(s?.trial_end ?? null)} - billing starts then. Cancel any time before that and you pay nothing.`
                : isPro
                  ? `Renews ${formatDate(s?.current_period_end ?? null)}`
                  : 'Upgrade for unlimited access - $8/month CAD with a 7-day free trial'}
            </div>
          </div>
          {isPro ? <ManageButton /> : <UpgradeButton />}
        </div>
        {isPro && !isTrialing && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              7-day money-back guarantee: not happy? Refund your last payment within 7 days, no questions asked.
            </span>
            <RefundButton />
          </div>
        )}
      </div>
    </div>
  )
}
