'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { StrategyFeedback } from '@/app/api/strategy-feedback/route'

function Spinner() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '13px',
        height: '13px',
        border: '2px solid currentColor',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    />
  )
}

function SkeletonBlock({ height = 80 }: { height?: number }) {
  return (
    <div
      style={{
        height,
        background: 'var(--border)',
        borderRadius: '10px',
        animation: 'shimmer 1.4s ease infinite',
      }}
    />
  )
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const card = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '20px',
}

const sectionTitle = {
  fontSize: '13px',
  fontWeight: 700,
  color: 'var(--text)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  marginBottom: '14px',
}

export default function StrategyReport() {
  const [feedback, setFeedback] = useState<StrategyFeedback | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function load(force = false) {
    if (force) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const res = await fetch(`/api/strategy-feedback${force ? '?force=true' : ''}`)
      const json = await res.json() as { feedback?: StrategyFeedback; generatedAt?: string; error?: string }
      if (!res.ok) {
        setError((json.error as string | undefined) ?? 'Failed to load strategy report.')
        return
      }
      setFeedback(json.feedback ?? null)
      setGeneratedAt(json.generatedAt ?? null)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          <SkeletonBlock height={90} />
          <SkeletonBlock height={90} />
          <SkeletonBlock height={90} />
        </div>
        <SkeletonBlock height={56} />
        <SkeletonBlock height={56} />
        <SkeletonBlock height={120} />
        <SkeletonBlock height={200} />
        <SkeletonBlock height={80} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        padding: '16px 20px',
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: 'var(--radius)',
        color: '#ef4444',
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
      }}>
        <span>{error}</span>
        <button
          type="button"
          onClick={() => void load()}
          style={{
            background: 'transparent',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '8px',
            color: '#ef4444',
            fontSize: '13px',
            padding: '6px 12px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!feedback) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Key Insights */}
      <section>
        <div style={sectionTitle}>Key Insights</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          {feedback.top_insights.map((insight, i) => (
            <div key={i} style={card}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, marginBottom: '8px' }}>
                #{i + 1}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.6 }}>{insight}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Focus here + Stop applying here side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
        <section style={card}>
          <div style={{ ...sectionTitle, color: '#22c55e' }}>Focus here</div>
          {feedback.focus_roles.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No clear standout roles yet.</div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {feedback.focus_roles.map((role, i) => (
                <span
                  key={i}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(34,197,94,0.35)',
                    background: 'rgba(34,197,94,0.07)',
                    color: '#22c55e',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  {role}
                </span>
              ))}
            </div>
          )}
        </section>

        <section style={card}>
          <div style={{ ...sectionTitle, color: '#ef4444' }}>Stop applying here</div>
          {feedback.avoid_roles.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No roles to avoid identified yet.</div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {feedback.avoid_roles.map((role, i) => (
                <span
                  key={i}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(239,68,68,0.35)',
                    background: 'rgba(239,68,68,0.07)',
                    color: '#ef4444',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  {role}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ATS correlation callout */}
      <section
        style={{
          padding: '16px 20px',
          background: 'rgba(59,130,246,0.05)',
          border: '1px solid rgba(59,130,246,0.18)',
          borderRadius: 'var(--radius)',
        }}
      >
        <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
          ATS Score Correlation
        </div>
        <div style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.6 }}>
          {feedback.ats_insight}
        </div>
      </section>

      {/* Next steps */}
      <section style={card}>
        <div style={sectionTitle}>Next steps</div>
        <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {feedback.top_suggestions.map((step, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                gap: '12px',
                padding: '12px 0',
                borderBottom: i < feedback.top_suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'flex-start',
              }}
            >
              <span
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'var(--border)',
                  color: 'var(--text)',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '1px',
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.6 }}>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Skills to add */}
      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={sectionTitle}>Skills to add to your profile</div>
          <Link
            href="/profile"
            style={{ fontSize: '13px', color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}
          >
            Add to profile →
          </Link>
        </div>
        {feedback.skill_gaps_to_fix.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No specific skill gaps identified.</div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {feedback.skill_gaps_to_fix.map((skill, i) => (
              <span
                key={i}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(245,158,11,0.35)',
                  background: 'rgba(245,158,11,0.07)',
                  color: '#f59e0b',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Footer: last updated + refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '4px' }}>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
          {generatedAt ? `Last updated ${relativeDate(generatedAt)}` : 'Just generated'}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--border)' }}>·</span>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          style={{
            background: 'transparent',
            border: 'none',
            color: refreshing ? 'var(--muted)' : 'var(--accent)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: refreshing ? 'default' : 'pointer',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {refreshing ? <Spinner /> : null}
          Refresh
        </button>
      </div>
    </div>
  )
}
