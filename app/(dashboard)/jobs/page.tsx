'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import ScoreBadge from '@/components/ui/ScoreBadge'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import { track } from '@/lib/analytics'

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobFeedItem {
  id: string
  external_job_id: string
  title: string
  company: string
  location: string
  url: string
  employment_type: string | null
  relevance_score: number
  is_saved: boolean
  is_dismissed: boolean
  raw_data: { reason?: string } | null
  fetched_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPLOYMENT_LABEL: Record<string, string> = {
  permanent: 'Full-time',
  contract: 'Contract',
  part_time: 'Part-time',
  temporary: 'Temporary',
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  onSave,
  onDismiss,
  saving,
}: {
  job: JobFeedItem
  onSave: (id: string, current: boolean) => void
  onDismiss: (id: string) => void
  saving: boolean
}) {
  const reason = job.raw_data?.reason
  const employmentLabel = job.employment_type ? (EMPLOYMENT_LABEL[job.employment_type] ?? job.employment_type) : null

  const smallBtn: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '5px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    color: 'var(--muted)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{
      background: 'var(--card)',
      border: `1px solid ${job.is_saved ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`,
      borderRadius: '12px',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      position: 'relative',
    }}>
      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => onDismiss(job.id)}
        title="Dismiss"
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'none',
          border: 'none',
          color: 'var(--muted)',
          cursor: 'pointer',
          padding: '4px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
        }}
      >
        <CloseIcon />
      </button>

      {/* Header */}
      <div style={{ paddingRight: '24px' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginBottom: '2px', lineHeight: 1.3 }}>
          {job.title}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
          {job.company}
          {job.location ? ` · ${job.location}` : ''}
        </div>
      </div>

      {/* Badges row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <ScoreBadge score={job.relevance_score} />
        {employmentLabel && (
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--muted)',
            border: '1px solid var(--border)',
          }}>
            {employmentLabel}
          </span>
        )}
      </div>

      {/* Reason */}
      {reason && (
        <div style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
          {reason}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          style={smallBtn}
        >
          View job ↗
        </a>
        <Link
          href={`/tailor?url=${encodeURIComponent(job.url)}`}
          onClick={() => track('job_discovered', { job_title: job.title, company: job.company })}
          style={smallBtn}
        >
          Tailor resume
        </Link>
        <button
          type="button"
          onClick={() => onSave(job.id, job.is_saved)}
          disabled={saving}
          title={job.is_saved ? 'Unsave' : 'Save'}
          style={{
            ...smallBtn,
            color: job.is_saved ? '#818cf8' : 'var(--muted)',
            borderColor: job.is_saved ? 'rgba(99,102,241,0.3)' : 'var(--border)',
            marginLeft: 'auto',
            opacity: saving ? 0.5 : 1,
          }}
        >
          <HeartIcon filled={job.is_saved} />
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [noTargetRoles, setNoTargetRoles] = useState(false)
  const [employmentFilter, setEmploymentFilter] = useState('all')
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())

  async function loadJobs(forceRefresh = false) {
    if (forceRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const url = forceRefresh ? '/api/discover-jobs?refresh=true' : '/api/discover-jobs'
      const res = await fetch(url, { cache: 'no-store' })
      const json = await res.json()

      if (json.noTargetRoles) {
        setNoTargetRoles(true)
        setJobs([])
      } else {
        setNoTargetRoles(false)
        setJobs((json.jobs ?? []) as JobFeedItem[])
      }
    } catch {
      // fail silently — keep existing list
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { void loadJobs() }, [])

  async function handleSave(id: string, currentValue: boolean) {
    setSavingIds(prev => new Set([...prev, id]))
    try {
      const res = await fetch(`/api/job-feed/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_saved: !currentValue }),
      })
      if (res.ok) {
        setJobs(prev => prev.map(j => j.id === id ? { ...j, is_saved: !currentValue } : j))
      }
    } catch {}
    finally {
      setSavingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  function handleDismiss(id: string) {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, is_dismissed: true } : j))
    fetch(`/api/job-feed/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_dismissed: true }),
    }).catch(() => {
      setJobs(prev => prev.map(j => j.id === id ? { ...j, is_dismissed: false } : j))
    })
  }

  const employmentTypes = useMemo(() => {
    const types = new Set(
      jobs.filter(j => !j.is_dismissed && j.employment_type).map(j => j.employment_type as string)
    )
    return Array.from(types)
  }, [jobs])

  const visible = useMemo(() => {
    let list = jobs.filter(j => !j.is_dismissed)
    if (employmentFilter !== 'all') {
      list = list.filter(j => j.employment_type === employmentFilter)
    }
    return [...list].sort((a, b) => {
      if (a.is_saved !== b.is_saved) return a.is_saved ? -1 : 1
      return b.relevance_score - a.relevance_score
    })
  }, [jobs, employmentFilter])

  const smallBtn: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '6px 14px',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    color: 'var(--muted)',
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>Job Feed</div>
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Personalized listings matched to your target roles
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {employmentTypes.length > 0 && (
            <select
              value={employmentFilter}
              onChange={e => setEmploymentFilter(e.target.value)}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text)',
                fontSize: '13px',
                padding: '6px 10px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">All types</option>
              {employmentTypes.map(t => (
                <option key={t} value={t}>{EMPLOYMENT_LABEL[t] ?? t}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => loadJobs(true)}
            disabled={refreshing}
            style={{ ...smallBtn, opacity: refreshing ? 0.6 : 1 }}
          >
            {refreshing && <Spinner size="sm" />}
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
          <Spinner size="lg" />
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Fetching and scoring jobs…</div>
        </div>
      ) : noTargetRoles ? (
        <EmptyState
          title="No target roles set"
          description="Add your target roles in Profile to get personalized job recommendations."
          actionLabel="Go to Profile"
          actionHref="/profile"
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No jobs found"
          description={employmentFilter !== 'all' ? 'No jobs match this filter. Try a different type.' : 'Click Refresh to fetch new listings for your target roles.'}
          actionLabel={employmentFilter !== 'all' ? undefined : 'Refresh'}
          actionOnClick={employmentFilter !== 'all' ? undefined : () => loadJobs(true)}
        />
      ) : (
        <div className="jobs-grid">
          {visible.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onSave={handleSave}
              onDismiss={handleDismiss}
              saving={savingIds.has(job.id)}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        .jobs-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }
        @media (max-width: 640px) {
          .jobs-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
