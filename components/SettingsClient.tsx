'use client'

// Settings page body: account email, theme, email preferences, base resume
// replacement, and the danger zone (reset data / delete account).
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Spinner from '@/components/ui/Spinner'
import ResumeUpload from '@/components/ResumeUpload'
import PageHeader from '@/components/ui/PageHeader'
import ErrorNotice from '@/components/ui/ErrorNotice'

interface Props {
  userId: string
  email: string
  marketingEmailsEnabled: boolean
}

// --- Theme Pill ---------------------------------------------------------------

function ThemePills() {
  const [theme, setTheme] = useState<'dark' | 'light'>('light')

  useEffect(() => {
    const stored = window.localStorage.getItem('vantage-theme')
    const current =
      stored === 'dark' || stored === 'light'
        ? stored
        : (document.documentElement.getAttribute('data-theme') as 'dark' | 'light' | null) ?? 'light'
    setTheme(current)
  }, [])

  function apply(next: 'dark' | 'light') {
    document.documentElement.setAttribute('data-theme', next)
    window.localStorage.setItem('vantage-theme', next)
    setTheme(next)
  }

  const pillBase: React.CSSProperties = {
    padding: '6px 20px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid var(--border)',
  }

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        type="button"
        onClick={() => apply('dark')}
        style={{
          ...pillBase,
          background: theme === 'dark' ? 'var(--border)' : 'transparent',
          color: theme === 'dark' ? 'var(--text)' : 'var(--muted)',
        }}
      >
        Dark
      </button>
      <button
        type="button"
        onClick={() => apply('light')}
        style={{
          ...pillBase,
          background: theme === 'light' ? 'var(--border)' : 'transparent',
          color: theme === 'light' ? 'var(--text)' : 'var(--muted)',
        }}
      >
        Light
      </button>
    </div>
  )
}

// --- Danger Confirmation Modal --------------------------------------------
// Shared by "Delete account" and "Reset my data": type-to-confirm gate for
// irreversible actions.

function ConfirmDangerModal({ title, description, confirmWord, actionLabel, busy, onClose, onConfirm }: {
  title: string
  description: string
  confirmWord: string
  actionLabel: string
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const [input, setInput] = useState('')

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-lg)',
          padding: '28px',
          width: '100%',
          maxWidth: '440px',
        }}
      >
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
          {title}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px', lineHeight: 1.6 }}>
          {description}
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px' }}>
            Type {confirmWord} to confirm
          </label>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={confirmWord}
            style={{
              width: '100%',
              padding: '9px 12px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--muted)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={input !== confirmWord || busy}
            style={{
              padding: '8px 16px',
              background: input === confirmWord && !busy ? 'rgba(239,68,68,0.15)' : 'transparent',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-sm)',
              color: input === confirmWord ? 'var(--score-red)' : 'rgba(239,68,68,0.4)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: input === confirmWord && !busy ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {busy && <Spinner size="sm" />}
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Main ---------------------------------------------------------------------

export default function SettingsClient({ userId, email, marketingEmailsEnabled }: Props) {
  const router = useRouter()
  const supabase = createClient()

  // Resume section
  const [resumeModalOpen, setResumeModalOpen] = useState(false)
  const [resumeSuccess, setResumeSuccess] = useState(false)

  // Email preferences
  const [marketingEnabled, setMarketingEnabled] = useState(marketingEmailsEnabled)
  const [savingMarketing, setSavingMarketing] = useState(false)
  const [marketingError, setMarketingError] = useState<string | null>(null)

  async function handleToggleMarketing() {
    const next = !marketingEnabled
    setSavingMarketing(true)
    setMarketingError(null)
    const { error } = await supabase
      .from('profiles')
      .update({ marketing_emails_enabled: next })
      .eq('id', userId)
    if (error) {
      setMarketingError('Could not save your preference. Please try again.')
    } else {
      setMarketingEnabled(next)
    }
    setSavingMarketing(false)
  }

  // Delete section
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Reset section - wipes data, keeps the account
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const sectionTitle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: '16px',
  }

  const label: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--muted)',
    marginBottom: '6px',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text)',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  }

  async function handleResetData() {
    setResetting(true)
    setResetError(null)
    try {
      const res = await fetch('/api/account/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'RESET' }),
      })
      const json = await res.json()
      if (!res.ok) {
        setResetError(json.error ?? 'Failed to reset your data.')
        setResetting(false)
        return
      }
      // Fresh start: send them to onboarding like a brand-new account.
      router.push('/dashboard/profile?new=true')
      router.refresh()
    } catch {
      setResetError('Network error. Please try again.')
      setResetting(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setDeleteError(json.error ?? 'Failed to delete account.')
        setDeleting(false)
        return
      }
      router.push('/login')
    } catch {
      setDeleteError('Network error. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <PageHeader title="Settings" subtitle="Manage your account and preferences." />
      </div>
      <div
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-md)',
          padding: '32px',
        }}
      >

        {/* -- Account ------------------------------------------------- */}
        <div>
          <div style={sectionTitle}>Account</div>
          <div style={{ marginBottom: '16px' }}>
            <label style={label}>Email</label>
            <input
              type="text"
              value={email}
              readOnly
              style={{ ...inputStyle, color: 'var(--muted)', cursor: 'default' }}
            />
          </div>
        </div>

        {/* -- Appearance ---------------------------------------------- */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', marginTop: '24px' }}>
          <div style={sectionTitle}>Appearance</div>
          <label style={{ ...label, marginBottom: '12px' }}>Theme</label>
          <ThemePills />
        </div>

        {/* -- Email preferences ---------------------------------------- */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', marginTop: '24px' }}>
          <div style={sectionTitle}>Email</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500, marginBottom: '4px' }}>
                Product updates
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>
                Occasional emails about new features and job search tips. Every email has an unsubscribe link.
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleToggleMarketing()}
              disabled={savingMarketing}
              aria-label={marketingEnabled ? 'Turn off product update emails' : 'Turn on product update emails'}
              style={{
                width: '36px',
                height: '20px',
                borderRadius: '10px',
                border: 'none',
                background: marketingEnabled ? '#22c55e' : 'var(--border)',
                cursor: savingMarketing ? 'not-allowed' : 'pointer',
                position: 'relative',
                transition: 'background 0.15s',
                flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute',
                top: '2px',
                left: marketingEnabled ? '18px' : '2px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.15s',
              }} />
            </button>
          </div>
          {marketingError && <ErrorNotice message={marketingError} style={{ marginTop: '10px' }} />}
        </div>

        {/* -- Resume -------------------------------------------------- */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', marginTop: '24px' }}>
          <div style={sectionTitle}>Resume</div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
            Replace your base resume. This will be used for all future tailoring and ATS scoring.
          </div>
          {resumeSuccess && (
            <div style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '16px', padding: '10px 14px', background: 'var(--card-raised)', border: '1px solid var(--border)', borderRadius: '8px' }}>
              Resume updated successfully.
            </div>
          )}
          {resumeModalOpen ? (
            <div
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '20px',
              }}
            >
              <ResumeUpload
                onUploadComplete={() => {
                  setResumeModalOpen(false)
                  setResumeSuccess(true)
                  setTimeout(() => setResumeSuccess(false), 4000)
                  router.refresh()
                }}
              />
              <button
                type="button"
                onClick={() => setResumeModalOpen(false)}
                style={{
                  marginTop: '12px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--muted)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setResumeModalOpen(true)}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Upload new resume
            </button>
          )}
        </div>

        {/* -- Danger Zone --------------------------------------------- */}
        <div
          style={{
            marginTop: '28px',
            background: 'rgba(239,68,68,0.04)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 'var(--radius)',
            padding: '20px',
          }}
        >
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--score-red)', marginBottom: '10px' }}>
            Danger zone
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px', lineHeight: 1.6 }}>
            Reset wipes your resumes, jobs, documents, and application history so you can start
            fresh while keeping your account. Delete removes everything including the account.
            Neither can be undone.
          </div>
          {resetError && <ErrorNotice message={resetError} style={{ marginBottom: '12px' }} />}
          {deleteError && <ErrorNotice message={deleteError} style={{ marginBottom: '12px' }} />}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setResetModalOpen(true)}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: 'var(--radius)',
                color: 'var(--score-red)',
                fontFamily: 'var(--font-display)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reset my data
            </button>
            <button
              type="button"
              onClick={() => setDeleteModalOpen(true)}
              style={{
                padding: '8px 16px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: 'var(--radius)',
                color: 'var(--score-red)',
                fontFamily: 'var(--font-display)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Delete account
            </button>
          </div>
        </div>
      </div>

      {resetModalOpen && (
        <ConfirmDangerModal
          title="Reset my data"
          description="This wipes your resumes, jobs, tailored documents, ATS scores, applications, outreach, and interview sessions, and clears your profile details. Your account, email, and subscription are kept. This cannot be undone."
          confirmWord="RESET"
          actionLabel="Reset my data"
          busy={resetting}
          onClose={() => setResetModalOpen(false)}
          onConfirm={handleResetData}
        />
      )}

      {deleteModalOpen && (
        <ConfirmDangerModal
          title="Delete account"
          description="This permanently deletes your account, all resumes, tailored documents, and application history. This action cannot be undone."
          confirmWord="DELETE"
          actionLabel="Delete account"
          busy={deleting}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleDeleteAccount}
        />
      )}
    </>
  )
}
