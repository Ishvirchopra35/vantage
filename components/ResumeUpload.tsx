'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ResumeInfo {
  id: string
  file_name: string
  created_at: string
}

interface ResumeUploadProps {
  onUploadComplete?: (rawText: string) => void
}

const spinnerStyle: React.CSSProperties = {
  display: 'inline-block',
  width: '13px',
  height: '13px',
  border: '2px solid currentColor',
  borderTopColor: 'transparent',
  borderRadius: '50%',
  animation: 'spin 0.6s linear infinite',
  flexShrink: 0,
}

export default function ResumeUpload({ onUploadComplete }: ResumeUploadProps) {
  const [current, setCurrent] = useState<ResumeInfo | null>(null)
  const [fetching, setFetching] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setFetching(false); return }

      const { data } = await supabase
        .from('resumes')
        .select('id, file_name, created_at')
        .eq('user_id', user.id)
        .eq('is_base', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (data) setCurrent(data as ResumeInfo)
      setFetching(false)
    }
    load()
  }, [])

  async function handleFile(file: File) {
    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    const allowedExts = ['pdf', 'docx', 'doc']
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ]
    if (!allowedExts.includes(ext) && !allowedTypes.includes(file.type)) {
      setError('Only PDF and Word documents are accepted.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be under 5MB.')
      return
    }

    setError(null)
    setSuccess(false)
    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${user.id}/${Date.now()}-${safeName}`

      const contentTypeMap: Record<string, string> = {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        doc: 'application/msword',
      }
      const uploadExt = file.name.toLowerCase().split('.').pop() ?? ''
      const uploadContentType = contentTypeMap[uploadExt] ?? file.type ?? 'application/octet-stream'

      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(path, file, { contentType: uploadContentType, upsert: false })

      if (uploadError) throw new Error(uploadError.message)

      const { data: signedData, error: signedError } = await supabase.storage
        .from('resumes')
        .createSignedUrl(path, 120)

      if (signedError || !signedData?.signedUrl) {
        throw new Error('Failed to generate download URL')
      }

      const parseRes = await fetch('/api/parse-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: signedData.signedUrl, fileName: file.name }),
      })
      const parseJson = await parseRes.json()
      if (!parseRes.ok) throw new Error(parseJson.error || 'Failed to extract text from the document')

      const saveRes = await fetch('/api/save-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl: path, fileName: file.name, rawText: parseJson.text }),
      })
      const saveJson = await saveRes.json()
      if (!saveRes.ok) throw new Error(saveJson.error || 'Failed to save resume')

      setCurrent({ id: saveJson.resume.id, file_name: file.name, created_at: new Date().toISOString() })
      if (onUploadComplete) onUploadComplete(parseJson.text as string)
      setSuccess(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Please try again.')
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (fetching) {
    return <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Loading...</div>
  }

  return (
    <>
      {current && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            marginBottom: '10px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--score-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span style={{ fontSize: '13px', color: 'var(--text)', flex: 1 }}>{current.file_name}</span>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {new Date(current.created_at).toLocaleDateString()}
          </span>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,.doc"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />

      <button
        onClick={() => fileRef.current?.click()}
        disabled={loading}
        style={{
          background: 'transparent',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '10px 18px',
          fontSize: '14px',
          fontWeight: 500,
          cursor: loading ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? (
          <>
            <span style={spinnerStyle} />
            Uploading...
          </>
        ) : (
          current ? 'Replace resume' : 'Upload resume'
        )}
      </button>

      {error && (
        <div
          style={{
            marginTop: '10px',
            padding: '10px 14px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '10px',
            color: 'var(--score-red)',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            marginTop: '10px',
            padding: '10px 14px',
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: '10px',
            color: 'var(--score-green)',
            fontSize: '13px',
          }}
        >
          Resume uploaded successfully.
        </div>
      )}
    </>
  )
}
