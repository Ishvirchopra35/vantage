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
          href={`/tailor?prefill=${encodeURIComponent(job.url)}`}
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

interface Filters {
  location: string
  jobType: string
  remote: boolean
  salaryMin: string
  datePosted: string
}

const EMPTY_FILTERS: Filters = { location: '', jobType: '', remote: false, salaryMin: '', datePosted: '' }

const JOB_TYPE_TO_CONTRACT: Record<string, string[]> = {
  'full-time': ['permanent'],
  'part-time': ['part_time'],
  'contract': ['contract', 'temporary'],
  'internship': ['internship'],
}

export default function JobsPage() {
  const [allJobs, setAllJobs] = useState<JobFeedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [noTargetRoles, setNoTargetRoles] = useState(false)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasActiveFilters = filters.location !== '' || filters.jobType !== '' || filters.remote || filters.salaryMin !== '' || filters.datePosted !== ''

  function clearFilters() { setFilters(EMPTY_FILTERS) }

  // Only called when user clicks "Fetch New Jobs" — never on filter change
  async function fetchJobs() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/discover-jobs?refresh=true', { cache: 'no-store' })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Failed to fetch jobs.')
        return
      }

      if (json.noTargetRoles) {
        setNoTargetRoles(true)
        setAllJobs([])
        localStorage.setItem('jobFeedCache', JSON.stringify({ noTargetRoles: true, jobs: [] }))
      } else {
        setNoTargetRoles(false)
        const jobsList = (json.jobs ?? []) as JobFeedItem[]
        setAllJobs(jobsList)
        localStorage.setItem('jobFeedCache', JSON.stringify({ noTargetRoles: false, jobs: jobsList }))
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
      setInitialLoadDone(true)
    }
  }

  // Load cached jobs from localStorage on mount — no API call
  useEffect(() => {
    try {
      const cached = localStorage.getItem('jobFeedCache')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed.jobs && Array.isArray(parsed.jobs)) {
          setAllJobs(parsed.jobs as JobFeedItem[])
        }
        if (parsed.noTargetRoles) setNoTargetRoles(true)
      }
    } catch {
      // fail silently
    } finally {
      setInitialLoadDone(true)
    }
  }, [])

  async function handleSave(id: string, currentValue: boolean) {
    setSavingIds(prev => new Set([...prev, id]))
    try {
      const res = await fetch(`/api/job-feed/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_saved: !currentValue }),
      })
      if (res.ok) {
        const updated = allJobs.map(j => j.id === id ? { ...j, is_saved: !currentValue } : j)
        setAllJobs(updated)
        localStorage.setItem('jobFeedCache', JSON.stringify({ noTargetRoles, jobs: updated }))
      }
    } catch {}
    finally {
      setSavingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  function handleDismiss(id: string) {
    const updated = allJobs.map(j => j.id === id ? { ...j, is_dismissed: true } : j)
    setAllJobs(updated)
    localStorage.setItem('jobFeedCache', JSON.stringify({ noTargetRoles, jobs: updated }))
    fetch(`/api/job-feed/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_dismissed: true }),
    }).catch(() => {
      const reverted = allJobs.map(j => j.id === id ? { ...j, is_dismissed: false } : j)
      setAllJobs(reverted)
      localStorage.setItem('jobFeedCache', JSON.stringify({ noTargetRoles, jobs: reverted }))
    })
  }

  // Derived — filters allJobs client-side, never triggers an API call
  const visible = useMemo(() => {
    let list = allJobs.filter(j => !j.is_dismissed)

    if (filters.jobType === 'internship') {
      list = list.filter(j => j.title.toLowerCase().includes('intern'))
    } else if (filters.jobType === 'full-time') {
      list = list.filter(j => {
        const et = (j.employment_type ?? '').toLowerCase()
        return et.includes('permanent') || et.includes('full')
      })
    } else if (filters.jobType === 'part-time') {
      list = list.filter(j => {
        const et = (j.employment_type ?? '').toLowerCase()
        return et.includes('part')
      })
    } else if (filters.jobType === 'contract') {
      list = list.filter(j => {
        const et = (j.employment_type ?? '').toLowerCase()
        return et.includes('contract') || j.title.toLowerCase().includes('contract')
      })
    }

    if (filters.location) {
      const loc = filters.location.toLowerCase()
      list = list.filter(j => j.location.toLowerCase().includes(loc))
    }
    if (filters.remote) {
      list = list.filter(j =>
        j.location.toLowerCase().includes('remote') ||
        j.title.toLowerCase().includes('remote')
      )
    }

    return [...list].sort((a, b) => {
      if (a.is_saved !== b.is_saved) return a.is_saved ? -1 : 1
      return b.relevance_score - a.relevance_score
    })
  }, [allJobs, filters])

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

      {error && (
        <div style={{
          marginBottom: '16px',
          padding: '12px 14px',
          borderRadius: '10px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          fontSize: '13px',
          color: 'var(--score-red)',
        }}>
          {error}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>Job Feed</div>
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Personalized listings matched to your target roles
          </div>
        </div>
        <button
          type="button"
          onClick={() => void fetchJobs()}
          disabled={loading}
          style={{ ...smallBtn, opacity: loading ? 0.6 : 1 }}
        >
          {loading && <Spinner size="sm" />}
          {loading ? 'Fetching…' : 'Fetch New'}
        </button>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: '16px',
        padding: '12px 16px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
      }}>
        <input
          type="text"
          placeholder="Location"
          value={filters.location}
          onChange={e => setFilters(prev => ({ ...prev, location: e.target.value }))}
          style={{ padding: '6px 10px', borderRadius: '7px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '12px', outline: 'none', width: '120px' }}
        />
        <select
          value={filters.jobType}
          onChange={e => setFilters(prev => ({ ...prev, jobType: e.target.value }))}
          style={{ padding: '6px 10px', borderRadius: '7px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
        >
          <option value="">Any type</option>
          <option value="full-time">Full-time</option>
          <option value="part-time">Part-time</option>
          <option value="contract">Contract</option>
          <option value="internship">Internship</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input
            type="checkbox"
            checked={filters.remote}
            onChange={e => setFilters(prev => ({ ...prev, remote: e.target.checked }))}
          />
          Remote only
        </label>
        <input
          type="number"
          placeholder="Min salary"
          value={filters.salaryMin}
          onChange={e => setFilters(prev => ({ ...prev, salaryMin: e.target.value }))}
          style={{ padding: '6px 10px', borderRadius: '7px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '12px', outline: 'none', width: '110px' }}
        />
        <select
          value={filters.datePosted}
          onChange={e => setFilters(prev => ({ ...prev, datePosted: e.target.value }))}
          style={{ padding: '6px 10px', borderRadius: '7px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
        >
          <option value="">Any time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            style={{ fontSize: '12px', color: 'var(--muted)', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {!initialLoadDone ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
          <Spinner size="lg" />
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading…</div>
        </div>
      ) : noTargetRoles ? (
        <EmptyState
          title="No target roles set"
          description="Add your target roles in Profile to get personalized job recommendations."
          actionLabel="Go to Profile"
          actionHref="/profile"
        />
      ) : visible.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>
              No jobs yet
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
              {hasActiveFilters ? 'No jobs match your filters. Try adjusting or clearing them.' : 'Click the button below to fetch personalized jobs.'}
            </div>
          </div>
          {!hasActiveFilters && (
            <button
              type="button"
              onClick={() => void fetchJobs()}
              disabled={loading}
              style={{
                background: 'var(--accent)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#000',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? <Spinner size="sm" /> : null}
              {loading ? 'Fetching…' : 'Fetch Jobs'}
            </button>
          )}
        </div>
      ) : (
        <>
          {loading && (
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted)' }}>
              <Spinner size="sm" />
              Fetching new jobs…
            </div>
          )}
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
            {visible.length} result{visible.length !== 1 ? 's' : ''} found
          </div>
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
        </>
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
