import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/requireAuth'
import { getRateLimitOverview } from '@/lib/rateLimit'
import PageHeader from '@/components/ui/PageHeader'

export const metadata = {
  title: 'Usage Limits',
}

export const dynamic = 'force-dynamic'

function formatReset(iso: string | null): string {
  if (!iso) return '-'
  const date = new Date(iso)
  const now = Date.now()
  const hours = Math.max(0, Math.round((date.getTime() - now) / 3_600_000))
  if (hours < 1) return 'within the hour'
  if (hours < 24) return `in ${hours}h`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function LimitsPage() {
  const auth = await requireAuth()
  if ('error' in auth) redirect('/login')
  const { user } = auth

  const overview = await getRateLimitOverview(user.id)
  const windowLabel = overview.window === 'month' ? 'per month' : 'per day'

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Usage limits"
        subtitle={
          overview.isAdmin
            ? 'Admin account: per-feature limits are bypassed for you, so usage is not counted.'
            : `How much of each feature you have used ${windowLabel}. A slot frees up when its oldest use leaves the window.`
        }
      />

      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-md)', padding: '24px' }}>
        {overview.statuses.map((status) => {
          const pct = status.unlimited || status.limit === 0
            ? 0
            : Math.min(100, Math.round((status.used / status.limit) * 100))
          const exhausted = !status.unlimited && status.remaining === 0
          return (
            <div
              key={status.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '12px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: '13px', color: 'var(--text)', flex: '1 1 220px', minWidth: 0 }}>
                {status.label}
              </span>
              {!status.unlimited && (
                <div style={{ flex: '2 1 160px', height: '4px', background: 'var(--border)', borderRadius: '2px' }}>
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: exhausted ? 'var(--score-red)' : 'var(--accent)',
                      borderRadius: '2px',
                    }}
                  />
                </div>
              )}
              <span style={{ fontSize: '12px', color: exhausted ? 'var(--score-red)' : 'var(--muted)', minWidth: '64px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {status.unlimited ? 'Unlimited' : `${status.used} / ${status.limit}`}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--muted)', minWidth: '110px', textAlign: 'right' }}>
                {status.unlimited ? '' : status.used > 0 ? `Frees up ${formatReset(status.resetAt)}` : ''}
              </span>
            </div>
          )
        })}
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '16px' }}>
          These are per-feature request limits, separate from your plan&apos;s monthly quotas.
          AI features can also pause briefly when the AI provider itself is at capacity.
        </div>
      </div>
    </div>
  )
}
