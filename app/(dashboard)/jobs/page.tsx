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
import { rateLimitMessage } from '@/lib/rateLimitMessage'
import { createClient } from '@/lib/supabase/client'

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
          View Job <ExternalLinkIcon />
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
}

const EMPTY_FILTERS: Filters = { location: '', jobType: '' }

interface FilterPreset {
  id: string
  name: string
  filters: Partial<Filters>
  created_at: string
}

const JOB_TYPE_TO_CONTRACT: Record<string, string[]> = {
  'full-time': ['permanent'],
  'part-time': ['part_time'],
  'contract': ['contract', 'temporary'],
  'internship': ['internship'],
}

export default function JobsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [allJobs, setAllJobs] = useState<JobFeedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [noTargetRoles, setNoTargetRoles] = useState(false)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Cache key is namespaced by user id so switching accounts on the same
  // device never surfaces another account's cached job feed.
  const [cacheKey, setCacheKey] = useState<string | null>(null)

  // Saved filter presets
  const [presets, setPresets] = useState<FilterPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)
  const [presetNameOpen, setPresetNameOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presetError, setPresetError] = useState<string | null>(null)

  function writeCache(key: string | null, payload: { noTargetRoles: boolean; jobs: JobFeedItem[] }) {
    if (!key) return
    try {
      localStorage.setItem(key, JSON.stringify(payload))
    } catch {
      // localStorage unavailable - caching is best-effort only
    }
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  function clearFilters() { setFilters(EMPTY_FILTERS) }

  // Only called when user clicks "Find New" - never on filter change.
  // Server-side filters (radius, salary, date posted, type) are passed along
  // so Adzuna returns matching jobs in the first place.
  async function fetchJobs() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ refresh: 'true' })
      if (filters.jobType) params.set('jobType', filters.jobType)

      const res = await fetch(`/api/discover-jobs?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()

      if (res.status === 429) {
        setError(json.error || rateLimitMessage(json.retryAfter))
        return
      }

      if (!res.ok) {
        setError(json.error || 'We could not load jobs right now. Try again.')
        return
      }

      if (json.noTargetRoles) {
        setNoTargetRoles(true)
        setAllJobs([])
        writeCache(cacheKey, { noTargetRoles: true, jobs: [] })
      } else {
        setNoTargetRoles(false)
        const jobsList = (json.jobs ?? []) as JobFeedItem[]
        setAllJobs(jobsList)
        writeCache(cacheKey, { noTargetRoles: false, jobs: jobsList })
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
      setInitialLoadDone(true)
    }
  }

  // Hydrate on mount: user-scoped localStorage first (instant, no request),
  // falling back to the jobs already stored in the database (no AI cost) -
  // so signing out and back in never loses the feed, while accounts on the
  // same device still can't see each other's cache.
  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      let key: string | null = null
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) key = `jobFeedCache:${user.id}`
      } catch {
        // Auth lookup failed - skip caching for this session
      }
      if (cancelled) return
      setCacheKey(key)

      let hydratedFromCache = false
      try {
        // Drop the legacy un-namespaced cache; it may belong to another account.
        localStorage.removeItem('jobFeedCache')
        const cached = key ? localStorage.getItem(key) : null
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed.jobs && Array.isArray(parsed.jobs) && parsed.jobs.length > 0) {
            setAllJobs(parsed.jobs as JobFeedItem[])
            hydratedFromCache = true
          }
          if (parsed.noTargetRoles) {
            setNoTargetRoles(true)
            hydratedFromCache = true
          }
        }
      } catch {
        // fail silently
      }

      if (!hydratedFromCache) {
        try {
          // Cache miss (fresh sign-in, new device): restore the stored feed.
          const res = await fetch('/api/discover-jobs', { cache: 'no-store' })
          if (res.ok) {
            const json = await res.json()
            const jobsList = (json.jobs ?? []) as JobFeedItem[]
            if (!cancelled && jobsList.length > 0) {
              setAllJobs(jobsList)
              writeCache(key, { noTargetRoles: false, jobs: jobsList })
            }
          }
        } catch {
          // Feed restore is best-effort; "Find new" still works
        }
      }

      if (!cancelled) setInitialLoadDone(true)
    }
    void hydrate()
    return () => { cancelled = true }
  }, [supabase])

  // Load saved filter presets once on mount
  useEffect(() => {
    let cancelled = false
    async function loadPresets() {
      try {
        const res = await fetch('/api/job-filter-presets')
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setPresets((json.presets ?? []) as FilterPreset[])
      } catch {
        // Presets are a convenience - fail silently
      }
    }
    void loadPresets()
    return () => { cancelled = true }
  }, [])

  function applyPreset(id: string) {
    setSelectedPresetId(id)
    if (!id) return
    const preset = presets.find(p => p.id === id)
    if (preset) {
      // Only known keys - older presets may carry filters that no longer exist.
      setFilters({
        location: preset.filters.location ?? '',
        jobType: preset.filters.jobType ?? '',
      })
    }
  }

  async function handleSavePreset() {
    if (!presetName.trim()) {
      setPresetError('Give the filter a name.')
      return
    }
    setSavingPreset(true)
    setPresetError(null)
    try {
      const res = await fetch('/api/job-filter-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: presetName.trim(), filters }),
      })
      const json = await res.json()
      if (!res.ok) {
        setPresetError(json.error ?? 'Could not save the filter.')
        return
      }
      const preset = json.preset as FilterPreset
      setPresets(prev => [preset, ...prev])
      setSelectedPresetId(preset.id)
      setPresetName('')
      setPresetNameOpen(false)
    } catch {
      setPresetError('Network error. Please try again.')
    } finally {
      setSavingPreset(false)
    }
  }

  async function handleDeletePreset() {
    if (!selectedPresetId) return
    const id = selectedPresetId
    setSelectedPresetId('')
    setPresets(prev => prev.filter(p => p.id !== id))
    try {
      await fetch(`/api/job-filter-presets/${id}`, { method: 'DELETE' })
    } catch {
      // Row stays server-side on failure; it reappears on next load
    }
  }

  async function handleSave(id: string, currentValue: boolean) {
    const nextValue = !currentValue

    // Optimistic update: flip the heart immediately so there's no perceived
    // delay, then persist in the background and revert only if the request fails.
    const applySaved = (saved: boolean) => {
      setAllJobs(prev => {
        const updated = prev.map(j => j.id === id ? { ...j, is_saved: saved } : j)
        writeCache(cacheKey, { noTargetRoles, jobs: updated })
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
    writeCache(cacheKey, { noTargetRoles, jobs: updated })
    fetch(`/api/job-feed/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_dismissed: true }),
    }).catch(() => {
      const reverted = allJobs.map(j => j.id === id ? { ...j, is_dismissed: false } : j)
      setAllJobs(reverted)
      writeCache(cacheKey, { noTargetRoles, jobs: reverted })
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

  // Filter-bar building blocks: a labelled column per control so the bar
  // reads as an organized form instead of a loose row of boxes.
  const filterFieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    flex: '1 1 130px',
    minWidth: 0,
    maxWidth: '180px',
  }

  const filterLabelStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
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

      {/* -- Filter bar ------------------------------------------------------
          One card, two aligned groups: labelled filter controls on the left,
          saved-filter presets on the right. Everything shares the
          .filter-control height so the row reads as a single system. */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: '12px 14px',
        marginBottom: '16px',
        padding: '14px 16px',
        background: 'var(--card)',
        borderRadius: '10px',
      }}>
        <div style={filterFieldStyle}>
          <label style={filterLabelStyle}>Location</label>
          <input
            type="text"
            placeholder="e.g. Toronto"
            value={filters.location}
            onChange={e => setFilters(prev => ({ ...prev, location: e.target.value }))}
            className="filter-control"
            style={{ width: '100%', minWidth: 0 }}
          />
        </div>
        <div style={filterFieldStyle}>
          <label style={filterLabelStyle}>Job type</label>
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
            style={{ width: '100%' }}
          />
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="filter-control"
            style={{ width: 'auto', color: 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Clear
          </button>
        )}

        {/* Spacer pushes the presets group to the card's right edge */}
        <div style={{ flex: '1 0 12px' }} />

        <div style={{ ...filterFieldStyle, maxWidth: '190px' }}>
          <label style={filterLabelStyle}>Saved filters</label>
          <CustomSelect
            value={selectedPresetId}
            onChange={applyPreset}
            options={[
              { value: '', label: presets.length === 0 ? 'None saved yet' : 'Choose a filter…' },
              ...presets.map(p => ({ value: p.id, label: p.name })),
            ]}
            triggerClassName="filter-control"
            style={{ width: '100%' }}
          />
        </div>
        {selectedPresetId && (
          <button
            type="button"
            onClick={() => void handleDeletePreset()}
            className="filter-control"
            style={{ width: 'auto', color: 'var(--score-red)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Delete
          </button>
        )}
        {presetNameOpen ? (
          <>
            <div style={{ ...filterFieldStyle, maxWidth: '190px' }}>
              <label style={filterLabelStyle}>Name this filter</label>
              <input
                type="text"
                placeholder="e.g. Toronto internships"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !savingPreset) void handleSavePreset() }}
                className="filter-control"
                style={{ width: '100%', minWidth: 0 }}
              />
            </div>
            <button
              type="button"
              onClick={() => void handleSavePreset()}
              disabled={savingPreset}
              className="filter-control"
              style={{ width: 'auto', cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: savingPreset ? 0.7 : 1 }}
            >
              {savingPreset && <Spinner size="sm" />}
              {savingPreset ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => { setPresetNameOpen(false); setPresetName(''); setPresetError(null) }}
              className="filter-control"
              style={{ width: 'auto', color: 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Cancel
            </button>
          </>
        ) : (
          hasActiveFilters && (
            <button
              type="button"
              onClick={() => setPresetNameOpen(true)}
              className="filter-control"
              style={{ width: 'auto', color: 'var(--muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Save these filters
            </button>
          )
        )}
        {presetError && (
          <span style={{ flexBasis: '100%', fontSize: '11px', color: 'var(--score-red)' }}>{presetError}</span>
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
