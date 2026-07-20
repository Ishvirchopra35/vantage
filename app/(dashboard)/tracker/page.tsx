'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ApplicationRow } from '@/app/api/applications/route'
import ApplicationDetailModal from '@/components/ApplicationDetailModal'
import SkeletonLoader from '@/components/ui/SkeletonLoader'
import CustomSelect from '@/components/CustomSelect'
import PageHeader from '@/components/ui/PageHeader'
import ErrorNotice from '@/components/ui/ErrorNotice'

// --- Types --------------------------------------------------------------------

type Status = ApplicationRow['status']

// --- Status cycle -------------------------------------------------------------
// Only the specific valid forward transitions - not an all-statuses cycle.
// Failure paths (applied→ghosted, interviewing→rejected) are set via the
// status dropdown, not the badge click.
const STATUS_NEXT: Partial<Record<Status, Status>> = {
  applied: 'interviewing',
  interviewing: 'offer',
}

const STATUS_LABEL: Record<Status, string> = {
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  ghosted: 'Ghosted',
}

const STATUS_COLOR: Record<Status, string> = {
  applied: 'var(--gold-dim)',
  interviewing: 'rgba(34,197,94,0.1)',
  offer: 'rgba(34,197,94,0.15)',
  rejected: 'rgba(239,68,68,0.1)',
  ghosted: 'rgba(239,68,68,0.1)',
}

const STATUS_TEXT: Record<Status, string> = {
  applied: 'var(--gold)',
  interviewing: 'var(--score-green)',
  offer: 'var(--score-green)',
  rejected: 'var(--score-red)',
  ghosted: 'var(--score-red)',
}

// All valid status options for the dropdown, in order
const ALL_STATUSES: Status[] = ['applied', 'interviewing', 'offer', 'rejected', 'ghosted']

// --- Helpers ------------------------------------------------------------------

function daysSince(dateStr: string | null): string {
  if (!dateStr) return '-'
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diffMs / 86_400_000)
  if (days < 14) return `${days}d`
  if (days < 60) return `${Math.floor(days / 7)}w`
  return `${Math.floor(days / 30)}m`
}

function avgAts(rows: ApplicationRow[]): string {
  const scores = rows.map(r => r.overall_score).filter((s): s is number => s !== null)
  if (!scores.length) return '-'
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length).toString()
}

async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
    const json = await res.json()
    if (!res.ok) {
      return { data: null, error: json.error ?? `Error ${res.status}` }
    }
    return { data: json as T, error: null }
  } catch {
    return { data: null, error: 'Network error. Please try again.' }
  }
}

// --- Spinner ------------------------------------------------------------------

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

// --- Style constants ----------------------------------------------------------

const card = {
  background: 'var(--card)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow-md)',
  padding: '24px',
}

const inputStyle = {
  background: 'var(--card-raised)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '10px',
  padding: '10px 12px',
  color: 'var(--text)',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box' as const,
  width: '100%',
}

const primaryBtn = {
  background: 'var(--btn-primary-bg)',
  color: 'var(--btn-primary-text)',
  border: 'none',
  borderRadius: 'var(--radius)',
  padding: '10px 20px',
  fontFamily: 'var(--font-display)',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  minHeight: '44px',
}

const secondaryBtn = {
  background: 'var(--card-raised)',
  color: 'var(--text)',
  border: 'none',
  borderRadius: '10px',
  padding: '10px 18px',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  minHeight: '44px',
}

// --- Page ---------------------------------------------------------------------

export default function TrackerPage() {
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [atLimit, setAtLimit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Status update: track which row id is pending so the badge shows a spinner
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [openStatusId, setOpenStatusId] = useState<string | null>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const dropdownPortalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openStatusId) return
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownPortalRef.current && !dropdownPortalRef.current.contains(e.target as Node)) {
        setOpenStatusId(null)
        setDropdownPos(null)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [openStatusId])

  // Log form
  const [showLogForm, setShowLogForm] = useState(false)
  const [logCompany, setLogCompany] = useState('')
  const [logRole, setLogRole] = useState('')
  const [logStatus, setLogStatus] = useState<Status>('applied')
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10))
  const [logSubmitting, setLogSubmitting] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)

  // -- Fetch -----------------------------------------------------------------

  useEffect(() => {
    void (async () => {
      const { data, error: fetchError } = await apiFetch<{
        applications: ApplicationRow[]
        atLimit: boolean
      }>('/api/applications')
      setLoading(false)
      if (fetchError || !data) {
        setError(fetchError ?? 'Failed to load applications.')
        return
      }
      setApplications(data.applications)
      setAtLimit(data.atLimit)
    })()
  }, [])

  // -- Stats bar -------------------------------------------------------------

  const total = applications.length
  const responseCount = applications.filter(
    a => a.status === 'interviewing' || a.status === 'offer'
  ).length
  const responseRate =
    total > 0 ? ((responseCount / total) * 100).toFixed(1) + '%' : '-'
  const activeInterviews = applications.filter(a => a.status === 'interviewing').length
  const atsAvg = avgAts(applications)

  // -- Status select - confirmed update, state set on success ---------------

  async function handleStatusSelect(row: ApplicationRow, newStatus: Status) {
    if (newStatus === row.status || updatingId || deletingId) return
    setOpenStatusId(null)
    setDropdownPos(null)
    setUpdatingId(row.id)
    setRowError(null)

    const { data, error: patchError } = await apiFetch<{ application: ApplicationRow }>(
      `/api/applications/${row.id}`,
      { method: 'PATCH', body: JSON.stringify({ status: newStatus }) }
    )

    setUpdatingId(null)

    if (patchError || !data?.application) {
      setRowError(patchError ?? 'Failed to update status.')
      return
    }

    setApplications(prev =>
      prev.map(a => (a.id === row.id ? { ...a, status: newStatus } : a))
    )
  }

  // -- Delete - remove row only after confirmed 204 --------------------------

  async function handleDelete(id: string) {
    if (deletingId || updatingId) return
    setDeletingId(id)
    setRowError(null)

    const res = await fetch(`/api/applications/${id}`, { method: 'DELETE' })
    setDeletingId(null)

    if (res.ok) {
      setApplications(prev => prev.filter(a => a.id !== id))
    } else {
      setRowError('Failed to delete. Please try again.')
    }
  }

  // -- Log application form submit -------------------------------------------

  async function handleLogSubmit() {
    if (!logCompany.trim() || !logRole.trim() || logSubmitting) return
    setLogError(null)
    setLogSubmitting(true)

    // Optimistic row - use a temp id until the server responds
    const tempId = `temp-${Date.now()}`
    const optimisticRow: ApplicationRow = {
      id: tempId,
      user_id: '',
      job_id: null,
      job_title: null,
      company: logCompany.trim(),
      role: logRole.trim(),
      job_url: null,
      status: logStatus,
      applied_date: logDate || null,
      resume_doc_id: null,
      cover_letter_doc_id: null,
      ats_score_id: null,
      notes: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      job_company: null,
      overall_score: null,
    }

    setApplications(prev => [optimisticRow, ...prev])
    setShowLogForm(false)
    setLogCompany('')
    setLogRole('')
    setLogStatus('applied')
    setLogDate(new Date().toISOString().slice(0, 10))

    const { data, error: postError } = await apiFetch<{ application: ApplicationRow }>(
      '/api/applications',
      {
        method: 'POST',
        body: JSON.stringify({
          company: optimisticRow.company,
          role: optimisticRow.role,
          status: optimisticRow.status,
          applied_date: optimisticRow.applied_date,
        }),
      }
    )

    setLogSubmitting(false)

    if (postError || !data?.application) {
      // Revert - remove the temp row
      setApplications(prev => prev.filter(a => a.id !== tempId))
      setShowLogForm(true)
      setLogCompany(optimisticRow.company)
      setLogRole(optimisticRow.role)
      setLogError(postError ?? 'Failed to log application.')
      return
    }

    // Replace temp row with real row from server
    setApplications(prev =>
      prev.map(a => (a.id === tempId ? data.application : a))
    )
  }

  // --- Render ---------------------------------------------------------------

  return (
    <div style={{ backgroundColor: 'var(--bg)', minHeight: '100vh' }}>
      <div className="dashboard-page">

        {/* -- Header ------------------------------------------------------- */}
        <PageHeader
          title="Applications"
          subtitle="Track every application in one place."
          action={(
            <button
              onClick={() => setShowLogForm(v => !v)}
              className="btn-gold-hover"
              style={primaryBtn}
            >
              {showLogForm ? 'Cancel' : '+ Log application'}
            </button>
          )}
        />

        {/* -- At-limit banner ---------------------------------------------- */}
        {atLimit && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '10px',
            fontSize: '14px',
            color: 'var(--text)',
            marginBottom: '16px',
          }}>
            <strong style={{ color: '#f59e0b' }}>You've hit the 150-application limit.</strong>{' '}
            Upgrade to Pro for unlimited tracking.
          </div>
        )}

        {/* -- Log form ----------------------------------------------------- */}
        {showLogForm && (
          <div style={{ ...card, marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '14px' }}>
              Log an application
            </div>
            <div className="tracker-log-form">
              <div style={{ flex: '1 1 160px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>Company</div>
                <input
                  placeholder="Acme Corp"
                  value={logCompany}
                  onChange={e => setLogCompany(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: '1 1 160px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>Role</div>
                <input
                  placeholder="Software Engineer"
                  value={logRole}
                  onChange={e => setLogRole(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: '0 0 140px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>Status</div>
                <CustomSelect
                  value={logStatus}
                  onChange={v => setLogStatus(v as Status)}
                  options={ALL_STATUSES.map(s => ({ value: s, label: STATUS_LABEL[s] }))}
                />
              </div>
              <div style={{ flex: '0 0 140px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>Date applied</div>
                <input
                  type="date"
                  value={logDate}
                  onChange={e => setLogDate(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <button
                onClick={handleLogSubmit}
                disabled={logSubmitting || !logCompany.trim() || !logRole.trim()}
                className="btn-gold-hover"
                style={{
                  ...primaryBtn,
                  flex: '0 0 auto',
                  opacity: logSubmitting || !logCompany.trim() || !logRole.trim() ? 0.5 : 1,
                }}
              >
                {logSubmitting ? <Spinner /> : 'Log'}
              </button>
            </div>
            {logError && <ErrorNotice message={logError} style={{ marginTop: '12px' }} />}
          </div>
        )}

        {/* -- Stats bar ---------------------------------------------------- */}
        {!loading && applications.length > 0 && (
          <div className="tracker-stats-grid fade-in">
            {[
              { label: 'Total', value: total.toString() },
              { label: 'Response rate', value: responseRate },
              { label: 'Active interviews', value: activeInterviews.toString() },
              { label: 'Avg ATS score', value: atsAvg },
            ].map(({ label, value }) => (
              <div key={label} style={{ ...card, padding: '16px' }}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>{value}</div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* -- Loading: skeleton mirrors stats grid + table ------------------ */}
        {loading && (
          <>
            <div className="tracker-stats-grid">
              {[1, 2, 3, 4].map(i => (
                <SkeletonLoader key={i} height={76} />
              ))}
            </div>
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1, 2, 3, 4, 5].map(i => (
                <SkeletonLoader key={i} height={52} />
              ))}
            </div>
          </>
        )}

        {/* -- Error -------------------------------------------------------- */}
        {error && <ErrorNotice message={error} style={{ padding: '16px', borderRadius: 'var(--radius)' }} />}

        {/* -- Empty state -------------------------------------------------- */}
        {!loading && !error && applications.length === 0 && (
          <div style={{
            ...card,
            textAlign: 'center',
            padding: '64px 24px',
          }}>
            <div style={{ width: '36px', height: '36px', margin: '0 auto 14px', background: 'var(--card-raised)', borderRadius: 'var(--radius-sm)', display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>
              No applications yet
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--muted)', marginBottom: '24px' }}>
              Log your first application to start tracking.
            </div>
            <button onClick={() => setShowLogForm(true)} className="btn-gold-hover" style={primaryBtn}>
              + Log application
            </button>
          </div>
        )}

        {/* -- Row-level error ---------------------------------------------- */}
        {rowError && <ErrorNotice message={rowError} style={{ marginBottom: '12px' }} />}

        {/* -- Table -------------------------------------------------------- */}
        {!loading && applications.length > 0 && (
          <div className="tracker-table-wrapper fade-in" style={{ ...card, padding: 0 }}>
            {/* columns: company(flex) | role(flex) | status(100px) | since(52px) | ats(52px) | delete(32px) */}
            <div className="tracker-table-row" style={{
              display: 'grid',
              padding: '10px 20px',
              borderBottom: '1px solid var(--border)',
              gap: '12px',
              alignItems: 'center',
              minWidth: 'min-content',
            }}>
              {[
                { label: 'Company', align: 'left', className: '' },
                { label: 'Role',    align: 'left', className: '' },
                { label: 'Status',  align: 'left', className: '' },
                { label: 'Since',   align: 'center', className: 'tracker-table-col-since' },
                { label: 'ATS',     align: 'center', className: '' },
                { label: '',        align: 'right', className: '' },
              ].map(({ label, align, className }) => (
                <div key={label} className={className} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: align as 'left' | 'center' | 'right' }}>
                  {label}
                </div>
              ))}
            </div>

            {/* Table rows */}
            {applications.map((row, idx) => {
              const isUpdating = updatingId === row.id
              const isDeleting = deletingId === row.id

              return (
                <div
                  key={row.id}
                  onClick={() => { if (!row.id.startsWith('temp-') && !isDeleting) setSelectedAppId(row.id) }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--card-raised)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = idx % 2 === 0 ? 'var(--card-sunken)' : 'transparent' }}
                  className="tracker-table-row"
                  style={{
                    display: 'grid',
                    padding: '13px 20px',
                    background: idx % 2 === 0 ? 'var(--card-sunken)' : 'transparent',
                    borderBottom: idx < applications.length - 1 ? '1px solid var(--border)' : 'none',
                    gap: '12px',
                    alignItems: 'center',
                    minHeight: '48px',
                    opacity: row.id.startsWith('temp-') || isDeleting ? 0.5 : 1,
                    transition: 'opacity 0.15s, background 0.15s ease',
                    overflow: 'visible',
                    cursor: row.id.startsWith('temp-') || isDeleting ? 'default' : 'pointer',
                  }}
                >
                  {/* Company */}
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.company}
                  </div>

                  {/* Role */}
                  <div style={{ fontSize: '13px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.role}
                  </div>

                  {/* Status badge - click opens portal dropdown */}
                  <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isUpdating || isDeleting) return
                        if (openStatusId === row.id) {
                          setOpenStatusId(null)
                          setDropdownPos(null)
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setDropdownPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX })
                          setOpenStatusId(row.id)
                        }
                      }}
                      disabled={isUpdating || isDeleting}
                      style={{
                        background: STATUS_COLOR[row.status],
                        color: STATUS_TEXT[row.status],
                        border: 'none',
                        borderRadius: '20px',
                        padding: '2px 7px',
                        fontFamily: 'var(--font-display)',
                        fontSize: '10px',
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase' as const,
                        cursor: isUpdating || isDeleting ? 'default' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        opacity: isUpdating ? 0.6 : 1,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      {isUpdating ? <Spinner /> : STATUS_LABEL[row.status]}
                    </button>
                  </div>

                  {/* Portal dropdown - renders outside the table DOM to avoid overflow clipping */}
                  {dropdownPos && openStatusId === row.id && createPortal(
                    <div
                      ref={dropdownPortalRef}
                      style={{
                        position: 'absolute',
                        top: dropdownPos.top,
                        left: dropdownPos.left,
                        background: 'var(--card-raised)',
                        borderRadius: 'var(--radius)',
                        zIndex: 9999,
                        minWidth: '140px',
                        boxShadow: 'var(--shadow-lg)',
                        overflow: 'hidden',
                      }}
                    >
                      {ALL_STATUSES.map(s => (
                        <button
                          key={s}
                          onClick={(e) => { e.stopPropagation(); handleStatusSelect(row, s) }}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            background: s === row.status ? 'var(--card-sunken)' : 'transparent',
                            border: 'none',
                            padding: '8px 12px',
                            fontSize: '13px',
                            color: STATUS_TEXT[s],
                            cursor: 'pointer',
                            fontWeight: s === row.status ? 600 : 400,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {STATUS_LABEL[s]}
                        </button>
                      ))}
                    </div>,
                    document.body
                  )}

                  {/* Days since - centered */}
                  <div className="tracker-table-col-since" style={{ fontSize: '13px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>
                    {daysSince(row.applied_date)}
                  </div>

                  {/* ATS score - centered */}
                  <div style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    textAlign: 'center',
                    color: row.overall_score !== null
                      ? row.overall_score >= 75 ? '#22c55e'
                      : row.overall_score >= 50 ? '#f59e0b'
                      : '#ef4444'
                      : 'var(--muted)',
                  }}>
                    {row.overall_score !== null ? row.overall_score : '-'}
                  </div>

                  {/* Delete - right-aligned */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(row.id) }}
                      disabled={isDeleting || isUpdating}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--muted)',
                        cursor: isDeleting || isUpdating ? 'default' : 'pointer',
                        fontSize: '16px',
                        padding: '2px 4px',
                        lineHeight: 1,
                        borderRadius: '4px',
                        opacity: isDeleting ? 0.4 : 1,
                        transition: 'opacity 0.15s',
                      }}
                      title="Delete application"
                    >
                      {isDeleting ? <Spinner /> : '×'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedAppId && (
        <ApplicationDetailModal
          applicationId={selectedAppId}
          onClose={() => setSelectedAppId(null)}
          onUpdated={updated => {
            // Keep the table row in sync with edits made inside the modal.
            setApplications(prev =>
              prev.map(a => (a.id === updated.id ? { ...a, ...updated } : a))
            )
          }}
        />
      )}
    </div>
  )
}
