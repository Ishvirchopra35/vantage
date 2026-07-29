import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StrategyReport from './StrategyReport'
import PageHeader from '@/components/ui/PageHeader'

export const metadata = {
  title: 'Strategy',
  description: 'What your application history says about your job search',
};

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function LockedState({ total }: { total: number }) {
  const progress = Math.min((total / 15) * 100, 100)

  return (
    <div style={{ backgroundColor: 'var(--bg)', minHeight: '100vh' }}>
      <div className="dashboard-page">
        <PageHeader
          title="Strategy"
          subtitle="Data-driven insights on your job search."
        />

        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-md)',
            padding: '48px 40px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--border)',
              color: 'var(--muted)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            <LockIcon />
          </div>

          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>
            Apply to 15 jobs to unlock your strategy report
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--muted)', margin: '0 0 28px', lineHeight: 1.6 }}>
            Your strategy report uses real data from your applications to surface what is and isn't working.
            You have <strong style={{ color: 'var(--text)' }}>{total}</strong> so far.
          </p>

          {/* Progress bar */}
          <div style={{ maxWidth: '320px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>Progress</span>
              <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>{total} / 15</span>
            </div>
            <div
              style={{
                height: '6px',
                background: 'var(--border)',
                borderRadius: '999px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'var(--accent)',
                  borderRadius: '999px',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default async function StrategyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { count } = await supabase
    .from('applications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('deleted_at', null)

  const total = count ?? 0

  if (total < 15) {
    return <LockedState total={total} />
  }

  return (
    <div style={{ backgroundColor: 'var(--bg)', minHeight: '100vh' }}>
      <div className="dashboard-page">
        <PageHeader
          title="Strategy"
          subtitle="Data-driven insights on your job search."
        />

        <StrategyReport />
      </div>
    </div>
  )
}
