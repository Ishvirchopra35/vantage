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
  tailoring_uses: number | null
  cover_letter_uses: number | null
  auto_apply_uses: number | null
  strategy_uses: number | null
  networking_uses: number | null
  interview_uses: number | null
  monthly_reset_at: string | null
}

interface UsageRowProps {
  label: string
  used: number
  limit: number | null
}

function UsageRow({ label, used, limit }: UsageRowProps) {
  const isUnlimited = limit === null
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100))

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
      <span style={{ fontSize: '13px', color: 'var(--text)', flex: 1 }}>{label}</span>
      {!isUnlimited && (
        <div style={{ flex: 2, margin: '0 16px', height: '4px', background: 'var(--border)', borderRadius: '2px' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: '2px' }} />
        </div>
      )}
      <span style={{ fontSize: '12px', color: 'var(--muted)', minWidth: '40px', textAlign: 'right' }}>
        {isUnlimited ? 'Unlimited' : `${used} / ${limit}`}
      </span>
    </div>
  )
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
    .select('plan, status, current_period_end, trial_end, tailoring_uses, cover_letter_uses, auto_apply_uses, strategy_uses, networking_uses, interview_uses, monthly_reset_at')
    .eq('user_id', user.id)
    .single()

  const s = sub as Subscription | null
  const plan = s?.plan ?? 'free'
  const isPro = plan === 'pro'
  const isTrialing = isPro && s?.status === 'trialing'

  const LIMITS = isPro
    ? { tailoring: null, cover_letter: null, auto_apply: null, strategy: null, networking: null, interview: null }
    : { tailoring: 10, cover_letter: 10, auto_apply: 20, strategy: 2, networking: 15, interview: 5 }

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
                  : 'Upgrade for unlimited access - $8/month with a 7-day free trial'}
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

      {/* Monthly usage card */}
      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-md)', padding: '24px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '20px' }}>Monthly Usage</div>
        <UsageRow label="Resume tailorings" used={s?.tailoring_uses ?? 0} limit={LIMITS.tailoring} />
        <UsageRow label="Cover letters" used={s?.cover_letter_uses ?? 0} limit={LIMITS.cover_letter} />
        <UsageRow label="Auto-apply credits" used={s?.auto_apply_uses ?? 0} limit={LIMITS.auto_apply} />
        <UsageRow label="Strategy feedback" used={s?.strategy_uses ?? 0} limit={LIMITS.strategy} />
        <UsageRow label="Networking drafts" used={s?.networking_uses ?? 0} limit={LIMITS.networking} />
        <UsageRow label="Interview prep sessions" used={s?.interview_uses ?? 0} limit={LIMITS.interview} />
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          Resets monthly · Next reset: {formatDate(s?.monthly_reset_at ?? null)}
        </div>
      </div>
    </div>
  )
}
