'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import ScoreBadge from '@/components/ui/ScoreBadge'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import SkeletonLoader from '@/components/ui/SkeletonLoader'
import CustomSelect from '@/components/CustomSelect'
import PageHeader from '@/components/ui/PageHeader'
import ExternalLinkIcon from '@/components/ui/ExternalLinkIcon'
import { track } from '@/lib/analytics'

// --- Types --------------------------------------------------------------------


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

// --- Constants ----------------------------------------------------------------

const EMPLOYMENT_LABEL: Record<string, string> = {
  permanent: 'Full-time',
  contract: 'Contract',
  part_time: 'Part-time',
  temporary: 'Temporary',
}

// --- Icons --------------------------------------------------------------------

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

// --- Job card -----------------------------------------------------------------

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
    background: 'var(--card-raised)',
    border: 'none',
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
      background: job.is_saved ? 'var(--card-raised)' : 'var(--card)',
      borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow-md)',
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
            fontSize: '10px',
            fontWeight: 600,
            padding: '2px 7px',
            borderRadius: '20px',
            background: 'var(--card-raised)',
            color: 'var(--muted)',
            border: 'none',
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
          View job <ExternalLinkIcon />
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
            opacity: 1,
          }}
        >
          <HeartIcon filled={job.is_saved} />
        </button>
      </div>
    </div>
  )
}

// --- Page ---------------------------------------------------------------------

interface Filters {
  location: string
  jobType: string
  salaryMin: string
  datePosted: string
}

const EMPTY_FILTERS: Filters = { location: '', jobType: '', salaryMin: '', datePosted: '' }

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

  const hasActiveFilters = filters.location !== '' || filters.jobType !== '' || filters.salaryMin !== '' || filters.datePosted !== ''

  function clearFilters() { setFilters(EMPTY_FILTERS) }

  // Only called when user clicks "Find New" - never on filter change
  async function fetchJobs() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/discover-jobs?refresh=true', { cache: 'no-store' })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'We could not load jobs right now. Try again.')
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

  // Load cached jobs from localStorage on mount - no API call
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
    const nextValue = !currentValue

    // Optimistic update: flip the heart immediately so there's no perceived
    // delay, then persist in the background and revert only if the request fails.
    const applySaved = (saved: boolean) => {
      setAllJobs(prev => {
        const updated = prev.map(j => j.id === id ? { ...j, is_saved: saved } : j)
        localStorage.setItem('jobFeedCache', JSON.stringify({ noTargetRoles, jobs: updated }))
        return updated
      })
    }

    applySaved(nextValue)
    setSavingIds(prev => new Set([...prev, id]))

    try {
      const res = await fetch(`/api/job-feed/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_saved: nextValue }),
      })
      if (!res.ok) applySaved(currentValue) // revert on server error
    } catch {
      applySaved(currentValue) // revert on network error
    } finally {
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

  // Derived - filters allJobs client-side, never triggers an API call
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
    <div className="dashboard-page">

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

      {/* -- Header -------------------------------------------------------- */}
      <PageHeader
        title="Job feed"
        subtitle="Personalized listings matched to your target roles."
        action={(
          <button
            type="button"
            onClick={() => void fetchJobs()}
            disabled={loading}
            style={{
              background: 'var(--btn-primary-bg)',
              border: 'none',
              color: 'var(--btn-primary-text)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              borderRadius: 'var(--radius)',
              padding: '10px 20px',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading && <Spinner size="sm" />}
            {loading ? 'Finding…' : 'Find new'}
          </button>
        )}
      />

      {/* -- Filter bar ---------------------------------------------------- */}
      <div style={{
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: '16px',
        padding: '15px 16px',
        background: 'var(--card)',
        borderRadius: '10px',
      }}>
        <input
          type="text"
          placeholder="Location"
          value={filters.location}
          onChange={e => setFilters(prev => ({ ...prev, location: e.target.value }))}
          className="filter-control"
          style={{ width: '120px' }}
        />
        <CustomSelect
          value={filters.jobType}
          onChange={v => setFilters(prev => ({ ...prev, jobType: v }))}
          options={[
            { value: '', label: 'Any type' },
            { value: 'full-time', label: 'Full-time' },
            { value: 'part-time', label: 'Part-time' },
            { value: 'contract', label: 'Contract' },
            { value: 'internship', label: 'Internship' },
          ]}
          triggerClassName="filter-control"
          style={{ minWidth: '140px' }}
        />
        <input
          type="number"
          placeholder="Min salary"
          value={filters.salaryMin}
          onChange={e => setFilters(prev => ({ ...prev, salaryMin: e.target.value }))}
          className="filter-control"
          style={{ width: '110px' }}
        />
        <CustomSelect
          value={filters.datePosted}
          onChange={v => setFilters(prev => ({ ...prev, datePosted: v }))}
          options={[
            { value: '', label: 'Any time' },
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'This week' },
            { value: 'month', label: 'This month' },
          ]}
          triggerClassName="filter-control"
          style={{ minWidth: '130px' }}
        />
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="filter-control"
            style={{ width: 'auto', color: 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* -- Content ------------------------------------------------------- */}
      {!initialLoadDone ? (
        <div className="jobs-grid">
          {[1, 2, 3, 4].map(i => (
            <SkeletonLoader key={i} height={180} />
          ))}
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
            <div style={{ width: '36px', height: '36px', margin: '0 auto 14px', background: 'var(--card-raised)', borderRadius: 'var(--radius-sm)', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>
              No jobs yet
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)' }}>
              {hasActiveFilters ? 'No jobs match your filters. Try adjusting or clearing them.' : 'Click the button below to find jobs picked for you.'}
            </div>
          </div>
          {!hasActiveFilters && (
            <button
              type="button"
              onClick={() => void fetchJobs()}
              disabled={loading}
              style={{
                background: 'var(--btn-primary-bg)',
                border: 'none',
                borderRadius: 'var(--radius)',
                padding: '10px 20px',
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--btn-primary-text)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? <Spinner size="sm" /> : null}
              {loading ? 'Finding…' : 'Find Jobs'}
            </button>
          )}
        </div>
      ) : (
        <>
          {loading && (
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted)' }}>
              <Spinner size="sm" />
              Finding new jobs…
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
