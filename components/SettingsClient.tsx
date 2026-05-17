'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Spinner from '@/components/ui/Spinner'
import ResumeUpload from '@/components/ResumeUpload'

interface Props {
  userId: string
  email: string
  fullName: string
}

// ─── Theme Pill ───────────────────────────────────────────────────────────────

function ThemePills() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const stored = window.localStorage.getItem('vantage-theme')
    const current =
      stored === 'dark' || stored === 'light'
        ? stored
        : (document.documentElement.getAttribute('data-theme') as 'dark' | 'light' | null) ?? 'dark'
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

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

function DeleteModal({ onClose, onConfirm, deleting }: {
  onClose: () => void
  onConfirm: () => void
  deleting: boolean
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
          borderRadius: '14px',
          padding: '28px',
          width: '100%',
          maxWidth: '440px',
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
          Delete account
        </div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px', lineHeight: 1.6 }}>
          This permanently deletes your account, all resumes, tailored documents, and application history.
          This action cannot be undone.
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginBottom: '8px' }}>
            Type DELETE to confirm
          </label>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="DELETE"
            style={{
              width: '100%',
              padding: '9px 12px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
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
            disabled={deleting}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '8px',
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
            disabled={input !== 'DELETE' || deleting}
            style={{
              padding: '8px 16px',
              background: input === 'DELETE' && !deleting ? 'rgba(239,68,68,0.15)' : 'transparent',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              color: input === 'DELETE' ? '#ef4444' : 'rgba(239,68,68,0.4)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: input === 'DELETE' && !deleting ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {deleting && <Spinner size="sm" />}
            Delete account
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SettingsClient({ email, fullName }: Props) {
  const router = useRouter()

  // Account section
  const [name, setName] = useState(fullName)
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  // Resume section
  const [resumeModalOpen, setResumeModalOpen] = useState(false)
  const [resumeSuccess, setResumeSuccess] = useState(false)

  // Delete section
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  const primaryBtn: React.CSSProperties = {
    padding: '8px 20px',
    background: 'var(--accent)',
    color: 'var(--bg)',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  }

  async function handleSaveName() {
    if (!name.trim()) return
    setSavingName(true)
    setNameError(null)
    setNameSaved(false)
    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setNameError(json.error ?? 'Failed to save.')
      } else {
        setNameSaved(true)
        setTimeout(() => setNameSaved(false), 2500)
        router.refresh()
      }
    } catch {
      setNameError('Network error. Please try again.')
    } finally {
      setSavingName(false)
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
      <div
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '32px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>
            Settings
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              cursor: 'pointer',
              fontSize: '22px',
              lineHeight: 1,
              padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>

        {/* ── Account ───────────────────────────────────────────────── */}
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
          <div style={{ marginBottom: '16px' }}>
            <label style={label}>Full name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              style={inputStyle}
            />
          </div>
          {nameError && (
            <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '12px' }}>{nameError}</div>
          )}
          <button
            type="button"
            onClick={handleSaveName}
            disabled={savingName || !name.trim()}
            style={{ ...primaryBtn, opacity: savingName || !name.trim() ? 0.6 : 1 }}
          >
            {savingName && <Spinner size="sm" />}
            {nameSaved ? 'Saved!' : 'Save name'}
          </button>
        </div>

        {/* ── Appearance ────────────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', marginTop: '24px' }}>
          <div style={sectionTitle}>Appearance</div>
          <label style={{ ...label, marginBottom: '12px' }}>Theme</label>
          <ThemePills />
        </div>

        {/* ── Resume ────────────────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', marginTop: '24px' }}>
          <div style={sectionTitle}>Resume</div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
            Replace your base resume. This will be used for all future tailoring and ATS scoring.
          </div>
          {resumeSuccess && (
            <div style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '16px', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: '8px' }}>
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

        {/* ── Danger Zone ───────────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px', marginTop: '24px' }}>
          <div style={{ ...sectionTitle, color: '#ef4444' }}>Danger zone</div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
            Permanently delete your account and all associated data. This cannot be undone.
          </div>
          {deleteError && (
            <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '12px' }}>{deleteError}</div>
          )}
          <button
            type="button"
            onClick={() => setDeleteModalOpen(true)}
            style={{
              padding: '8px 16px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Delete account
          </button>
        </div>
      </div>

      {deleteModalOpen && (
        <DeleteModal
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleDeleteAccount}
          deleting={deleting}
        />
      )}
    </>
  )
}
