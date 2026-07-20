'use client'

// Makes the outcome loop visible. Below the confidence threshold this shows
// progress toward it, which is the point: it tells users why tracking outcomes
// is worth the effort before there is enough data to prove it.
import { useEffect, useState } from 'react'

interface OutcomeSignal {
  factor: string
  respondedRate: number
  comparisonRate: number
  comparisonLabel: string
  sampleSize: number
}

interface OutcomeAnalysis {
  decidedApplications: number
  linkedApplications: number
  overallResponseRate: number
  confident: boolean
  signals: OutcomeSignal[]
}

interface OutcomeInsightsProps {
  /** Bumped by the parent after a status change so the panel refetches. */
  refreshKey?: number
}

export default function OutcomeInsights({ refreshKey = 0 }: OutcomeInsightsProps): React.ReactElement | null {
  const [outcomes, setOutcomes] = useState<OutcomeAnalysis | null>(null)
  const [threshold, setThreshold] = useState(15)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/outcomes')
        if (!res.ok) return
        const json = await res.json()
        if (json?.outcomes) {
          setOutcomes(json.outcomes as OutcomeAnalysis)
          if (typeof json.threshold === 'number') setThreshold(json.threshold)
        }
      } catch {
        // Silent - this panel is additive, never worth an error box.
      }
    })()
  }, [refreshKey])

  // Nothing decided yet means nothing to say. A brand-new user should not see
  // an empty analytics panel on their first visit.
  if (!outcomes || outcomes.decidedApplications === 0) return null

  const { decidedApplications, overallResponseRate, confident, signals } = outcomes
  const progress = Math.min(100, Math.round((decidedApplications / threshold) * 100))

  return (
    <div className="ds-card fade-in" style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
        What is working
      </div>

      {!confident ? (
        <>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '14px', lineHeight: 1.5 }}>
            Vantage starts spotting patterns in your applications once {threshold} of them have a
            final outcome. You are at {decidedApplications}.
          </div>
          <div
            style={{
              height: '6px',
              borderRadius: '999px',
              background: 'var(--border-subtle)',
              overflow: 'hidden',
            }}
            role="progressbar"
            aria-valuenow={decidedApplications}
            aria-valuemin={0}
            aria-valuemax={threshold}
            aria-label="Applications with a final outcome"
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'var(--text)',
                opacity: 0.55,
                borderRadius: '999px',
                transition: 'width 400ms ease',
              }}
            />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '10px' }}>
            An outcome is final once an application is marked interviewing, offer, rejected, or
            ghosted.
          </div>
        </>
      ) : signals.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
          Across {decidedApplications} finished applications your response rate is{' '}
          {overallResponseRate}%. No single factor stands out as the difference yet.
        </div>
      ) : (
        <>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '14px' }}>
            From {decidedApplications} finished applications, at a {overallResponseRate}% overall
            response rate.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {signals.map(signal => (
              <div key={signal.factor} style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: 'var(--score-green)',
                    minWidth: '54px',
                  }}
                >
                  {signal.respondedRate}%
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>
                  {signal.factor}
                  <span style={{ color: 'var(--muted)' }}>
                    {' '}
                    versus {signal.comparisonRate}% for {signal.comparisonLabel} ({signal.sampleSize}{' '}
                    applications)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
